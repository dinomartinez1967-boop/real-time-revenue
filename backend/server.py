"""
OpenDroid Sandbox — FastAPI entrypoint.

Routes are all under /api. WebSocket endpoints:
  /api/ws/analytics  — 1Hz aggregate + per-network stats
  /api/ws/feed       — event stream (new posts, bans, orders)
"""
from __future__ import annotations
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from networks import NETWORKS, NICHES
from simulation import ENGINE
from llm_gateway import GATEWAY


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("opendroid")


# ---------------------------------------------------------------------
# Mongo — used only to snapshot state so restarts don't lose everything.
# The hot loop stays in memory.
# ---------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]


async def _snapshot_worker():
    while True:
        try:
            snap = ENGINE.snapshot()
            snap["_id"] = "latest"
            await db.sandbox_state.replace_one({"_id": "latest"}, snap, upsert=True)
        except Exception as e:  # noqa
            logger.warning(f"snapshot failed: {e}")
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine_task = asyncio.create_task(ENGINE.run())
    snap_task = asyncio.create_task(_snapshot_worker())
    logger.info("OpenDroid sandbox engine started.")
    try:
        yield
    finally:
        engine_task.cancel()
        snap_task.cancel()
        mongo_client.close()


app = FastAPI(title="OpenDroid Sandbox", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------
class PublishRequest(BaseModel):
    network: str
    prompt: str = Field(..., min_length=3, max_length=800)
    use_llm: bool = True


class NicheRequest(BaseModel):
    key: str


# ---------------------------------------------------------------------
# REST
# ---------------------------------------------------------------------
@api.get("/")
async def root():
    return {
        "service": "opendroid-sandbox",
        "status": "online",
        "ts": datetime.now(timezone.utc).isoformat(),
        "networks": list(NETWORKS.keys()),
        "niches": list(NICHES.keys()),
    }


@api.get("/state")
async def get_state():
    return ENGINE.snapshot()


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
        result = GATEWAY.generate(req.prompt, req.network, ENGINE.niche_key)
    else:
        result = {"content": req.prompt, "quality": 0.55, "provider": "raw", "latency_ms": 0}
    post = ENGINE.publish(req.network, result["content"], result["quality"])
    return {"post": post, "llm": result}


@api.post("/sandbox/flush")
async def flush():
    ENGINE.flush_sandbox()
    return {"ok": True, "message": "sandbox flushed"}


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
        # send an initial full snapshot so the UI hydrates immediately
        await ws.send_json({"type": "snapshot", **ENGINE.snapshot()})
        while True:
            evt = await q.get()
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
