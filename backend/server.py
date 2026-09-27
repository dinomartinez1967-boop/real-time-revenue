"""
OpenDroid Sandbox — FastAPI entrypoint.

Routes (all under /api):
  GET   /                        service info
  GET   /state                   full engine snapshot
  GET   /networks                network catalog
  GET   /niches                  niche catalog
  POST  /niche                   switch active niche
  GET   /feed/{network}          per-network feed
  POST  /agents/publish          single one-off publish (operator button)
  POST  /sandbox/flush           reset ephemeral state

  # mode + safety
  GET   /mode                    current mode + driver arm state
  POST  /mode                    switch sandbox <-> graduated
  POST  /drivers/arm             arm/disarm a real-integration driver

  # multi-agent swarm
  GET   /swarm/agents            list agents + leaderboard
  POST  /swarm/agents            spawn an agent
  DELETE /swarm/agents/{id}      stop + remove
  POST  /swarm/stop_all

  # analytics history
  GET   /analytics/history       last N persisted snapshots

  # LLM
  GET   /llm/status              gateway readiness

  # production drivers (graduated only)
  GET   /drivers/status
  POST  /drivers/dropdashin/order
  POST  /drivers/facebook/listing

WebSocket:
  /api/ws/analytics   1Hz stream of aggregates + per-network deltas
  /api/ws/feed        push events (post, ban, order)
"""
from __future__ import annotations
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

# CRITICAL: load .env before importing modules that read env at import time
from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import APIRouter, FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from networks import NETWORKS, NICHES
from simulation import ENGINE
from llm_gateway import GATEWAY
from mode import MODE
from agents import SWARM
from production_drivers import SUPPLIER, FB_MP

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("opendroid")


# ---------------------------------------------------------------------
# Mongo
# ---------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]


async def _prune_history() -> None:
    """Keep the sandbox_history collection at ~1500 points."""
    total = await db.sandbox_history.count_documents({})
    if total <= 1500:
        return
    to_del = total - 1500
    cursor = db.sandbox_history.find({}).sort("tick", 1).limit(to_del)
    ids = [d["_id"] async for d in cursor]
    if ids:
        await db.sandbox_history.delete_many({"_id": {"$in": ids}})


async def _persist_snapshot(snap: dict) -> None:
    """Persist one snapshot: latest doc + history point."""
    await db.sandbox_state.replace_one(
        {"_id": "latest"}, {**snap, "_id": "latest"}, upsert=True
    )
    latest = snap["series"][-1] if snap["series"] else None
    if not latest:
        return
    await db.sandbox_history.insert_one({
        "ts": snap["ts"],
        "tick": snap["tick"],
        "niche": snap["niche"]["key"],
        "mode": MODE.state.mode,
        **latest,
        "totals": snap["totals"],
    })
    await _prune_history()


async def _snapshot_worker():
    """Persist a compact snapshot every 5s so revenue + traffic curves survive
    a page refresh or a server restart."""
    while True:
        try:
            await _persist_snapshot(ENGINE.snapshot())
        except Exception as e:  # noqa
            logger.warning(f"snapshot failed: {e}")
        await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine_task = asyncio.create_task(ENGINE.run())
    snap_task = asyncio.create_task(_snapshot_worker())
    logger.info("OpenDroid sandbox engine started.")
    try:
        yield
    finally:
        SWARM.stop_all()
        engine_task.cancel()
        snap_task.cancel()
        mongo_client.close()


app = FastAPI(title="OpenDroid Sandbox", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------
class PublishRequest(BaseModel):
    network: str
    prompt: str = Field(..., min_length=3, max_length=800)
    use_llm: bool = True
    provider: str = "openai"


class NicheRequest(BaseModel):
    key: str


class ModeRequest(BaseModel):
    mode: str  # 'sandbox' | 'graduated'


class ArmRequest(BaseModel):
    driver: str
    on: bool


class SpawnAgentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    playbook: str = Field(..., min_length=3, max_length=200)
    target_networks: list[str] = Field(..., min_length=1)
    tone: str = "punchy contrarian"
    provider: str = "openai"
    model: str | None = None
    cadence_s: int = 12


class OrderRequest(BaseModel):
    product: str
    quantity: int = 1
    customer_ref: str = ""


class ListingRequest(BaseModel):
    title: str
    price: float
    description: str = ""


# ---------------------------------------------------------------------
# Core REST
# ---------------------------------------------------------------------
@api.get("/")
async def root():
    return {
        "service": "opendroid-sandbox",
        "status": "online",
        "ts": datetime.now(timezone.utc).isoformat(),
        "mode": MODE.state.to_dict(),
        "networks": list(NETWORKS.keys()),
        "niches": list(NICHES.keys()),
    }


@api.get("/state")
async def get_state():
    snap = ENGINE.snapshot()
    snap["mode"] = MODE.state.to_dict()
    snap["swarm"] = SWARM.leaderboard()
    return snap


@api.get("/networks")
async def list_networks():
    return [{"key": k, **v} for k, v in NETWORKS.items()]


@api.get("/niches")
async def list_niches():
    return [{"key": k, **v} for k, v in NICHES.items()]


@api.post("/niche")
async def set_niche(req: NicheRequest):
    if req.key not in NICHES:
        raise HTTPException(400, "unknown niche")
    ENGINE.set_niche(req.key)
    return {"ok": True, "niche": req.key}


@api.get("/feed/{network}")
async def get_feed(network: str, limit: int = 20):
    if network not in NETWORKS:
        raise HTTPException(404, "unknown network")
    return list(ENGINE.feeds[network])[:limit]


@api.post("/agents/publish")
async def publish(req: PublishRequest):
    if req.network not in NETWORKS:
        raise HTTPException(400, "unknown network")
    if req.use_llm:
        result = await GATEWAY.generate(
            req.prompt, req.network, NICHES[ENGINE.niche_key]["label"],
            provider=req.provider,
        )
    else:
        result = {"content": req.prompt, "quality": 0.55,
                  "provider": "raw", "model": "-", "source": "operator",
                  "latency_ms": 0}
    post = ENGINE.publish(req.network, result["content"], result["quality"])
    post["llm_source"] = result["source"]
    return {"post": post, "llm": result}


@api.post("/sandbox/flush")
async def flush():
    ENGINE.flush_sandbox()
    await db.sandbox_history.delete_many({})
    return {"ok": True, "message": "sandbox flushed"}


# ---------------------------------------------------------------------
# Mode + safety
# ---------------------------------------------------------------------
@api.get("/mode")
async def get_mode():
    return MODE.state.to_dict()


@api.post("/mode")
async def set_mode(req: ModeRequest):
    try:
        state = MODE.set_mode(req.mode)  # type: ignore[arg-type]
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    # switching to sandbox stops the swarm too — safest default
    if req.mode == "sandbox":
        SWARM.stop_all()
    return state.to_dict()


@api.post("/drivers/arm")
async def arm_driver(req: ArmRequest):
    try:
        state = MODE.arm_driver(req.driver, req.on)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return state.to_dict()


@api.get("/drivers/status")
async def drivers_status():
    return {
        "supplier": SUPPLIER.status(),
        "facebook_marketplace": FB_MP.status(),
        "mode": MODE.state.to_dict(),
    }


@api.post("/drivers/dropdashin/order")
async def route_order(req: OrderRequest):
    return await SUPPLIER.place_order(req.model_dump())


@api.post("/drivers/facebook/listing")
async def publish_listing(req: ListingRequest):
    return await FB_MP.publish_listing(req.model_dump())


# ---------------------------------------------------------------------
# Multi-agent swarm
# ---------------------------------------------------------------------
@api.get("/swarm/agents")
async def list_agents():
    return {"agents": SWARM.leaderboard(), "count": len(SWARM.agents)}


@api.post("/swarm/agents")
async def spawn_agent(req: SpawnAgentRequest):
    try:
        agent = SWARM.spawn(
            name=req.name,
            playbook=req.playbook,
            target_networks=req.target_networks,
            tone=req.tone,
            provider=req.provider,
            model=req.model,
            cadence_s=req.cadence_s,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return agent.to_dict()


@api.delete("/swarm/agents/{agent_id}")
async def stop_agent(agent_id: str):
    SWARM.stop(agent_id)
    return {"ok": True, "id": agent_id}


@api.post("/swarm/stop_all")
async def stop_all_agents():
    SWARM.stop_all()
    return {"ok": True}


# ---------------------------------------------------------------------
# Analytics history — persisted curves
# ---------------------------------------------------------------------
@api.get("/analytics/history")
async def analytics_history(limit: int = 200):
    limit = max(10, min(1000, limit))
    cursor = db.sandbox_history.find(
        {}, {"_id": 0}
    ).sort("tick", -1).limit(limit)
    rows = [row async for row in cursor]
    rows.reverse()
    return {"count": len(rows), "series": rows}


# ---------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------
@api.get("/llm/status")
async def llm_status():
    return GATEWAY.status()


# ---------------------------------------------------------------------
# WebSockets
# ---------------------------------------------------------------------
@app.websocket("/api/ws/analytics")
async def ws_analytics(ws: WebSocket):
    await ws.accept()
    q = ENGINE.subscribe_analytics()
    try:
        snap = ENGINE.snapshot()
        snap["mode"] = MODE.state.to_dict()
        snap["swarm"] = SWARM.leaderboard()
        await ws.send_json({"type": "snapshot", **snap})
        while True:
            evt = await q.get()
            evt["swarm"] = SWARM.leaderboard()
            evt["mode"] = MODE.state.mode
            await ws.send_json(evt)
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa
        logger.info(f"ws analytics closed: {e}")
    finally:
        ENGINE.unsubscribe_analytics(q)


@app.websocket("/api/ws/feed")
async def ws_feed(ws: WebSocket):
    await ws.accept()
    q = ENGINE.subscribe_feed()
    try:
        while True:
            evt = await q.get()
            await ws.send_json(evt)
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa
        logger.info(f"ws feed closed: {e}")
    finally:
        ENGINE.unsubscribe_feed(q)


# ---------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
