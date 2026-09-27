"""
Multi-Agent Swarm.

Each Agent has a playbook and an independent async task that publishes to
its target networks on cadence. Agents compete on the same feed and their
metrics are tallied so the operator can see a leaderboard.

Agents work in both modes:
  sandbox   → LLM Gateway returns `sim` content (deterministic)
  graduated → LLM Gateway can burn real credits (Emergent key)

Nothing here talks to real social platforms — that's the driver layer's job.
"""
from __future__ import annotations
import asyncio
import random
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

from llm_gateway import GATEWAY, DEFAULT_MODELS
from simulation import ENGINE
from networks import NETWORKS, NICHES


TONES = [
    "punchy contrarian",
    "receipt-driven case study",
    "vulnerable founder story",
    "data-heavy analyst",
    "energetic hype",
    "cold spreadsheet",
]

PROMPT_LIBRARY = [
    "share a specific $ number your funnel produced last week",
    "call out a common playbook that stopped working in 2026",
    "show a one-sentence proof + call-to-action",
    "expose a metric most creators are still ignoring",
    "post a receipt from the Dropdashin store",
    "compare CPMs between two of the 10 networks",
    "describe the exact 3-step DM automation you shipped",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Agent:
    id: str
    name: str
    playbook: str            # short description
    target_networks: list    # e.g. ["tiktok","instagram"]
    tone: str
    provider: str = "openai"
    model: str = "gpt-5.4"
    cadence_s: int = 12
    active: bool = True
    posts: int = 0
    total_earnings: float = 0.0
    total_impressions: int = 0
    last_post_at: Optional[str] = None
    last_content: Optional[str] = None
    last_source: str = "sim"
    last_quality: float = 0.0
    _task: Optional[asyncio.Task] = field(default=None, repr=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "playbook": self.playbook,
            "target_networks": list(self.target_networks),
            "tone": self.tone,
            "provider": self.provider,
            "model": self.model,
            "cadence_s": self.cadence_s,
            "active": self.active,
            "posts": self.posts,
            "total_earnings": self.total_earnings,
            "total_impressions": self.total_impressions,
            "last_post_at": self.last_post_at,
            "last_content": self.last_content,
            "last_source": self.last_source,
            "last_quality": self.last_quality,
        }


@dataclass
class SpawnConfig:
    name: str
    playbook: str
    target_networks: list
    tone: str = "punchy contrarian"
    provider: str = "openai"
    model: Optional[str] = None
    cadence_s: int = 12


class SwarmManager:
    def __init__(self) -> None:
        self.agents: dict[str, Agent] = {}

    # ------------------------------------------------------------------
    def list(self) -> list[dict]:
        return [a.to_dict() for a in self.agents.values()]

    def spawn(self, **kwargs) -> Agent:
        """Spawn from either an unpacked SpawnConfig or matching kwargs.
        Kept variadic so existing callers keep working."""
        cfg = SpawnConfig(**{
            k: v for k, v in kwargs.items()
            if k in SpawnConfig.__dataclass_fields__
        })
        for n in cfg.target_networks:
            if n not in NETWORKS:
                raise ValueError(f"unknown network: {n}")
        if cfg.provider not in DEFAULT_MODELS:
            raise ValueError(f"unknown provider: {cfg.provider}")
        agent = Agent(
            id=uuid.uuid4().hex[:10],
            name=cfg.name.strip() or f"agent-{uuid.uuid4().hex[:4]}",
            playbook=cfg.playbook.strip() or random.choice(PROMPT_LIBRARY),
            target_networks=list(cfg.target_networks),
            tone=cfg.tone,
            provider=cfg.provider,
            model=cfg.model or DEFAULT_MODELS[cfg.provider],
            cadence_s=max(3, int(cfg.cadence_s)),
        )
        self.agents[agent.id] = agent
        agent._task = asyncio.create_task(self._run_agent(agent))
        return agent

    def stop(self, agent_id: str) -> None:
        a = self.agents.get(agent_id)
        if not a:
            return
        a.active = False
        if a._task:
            a._task.cancel()
        self.agents.pop(agent_id, None)

    def stop_all(self) -> None:
        for a in list(self.agents.values()):
            self.stop(a.id)

    def leaderboard(self) -> list[dict]:
        return sorted(
            [a.to_dict() for a in self.agents.values()],
            key=lambda x: x["total_earnings"],
            reverse=True,
        )

    # ------------------------------------------------------------------
    async def _run_agent(self, agent: Agent) -> None:
        """Loop until the agent is stopped. On each tick, pick a target
        network, ask the LLM Gateway for content, publish."""
        # small stagger so multiple spawned agents don't race
        await asyncio.sleep(random.uniform(0.3, 2.0))
        while agent.active:
            try:
                network = random.choice(agent.target_networks)
                niche = NICHES[ENGINE.niche_key]
                prompt = self._build_prompt(agent, network, niche["label"])
                result = await GATEWAY.generate(
                    prompt, network, niche["label"],
                    provider=agent.provider, model=agent.model,
                )
                post = ENGINE.publish(network, result["content"], result["quality"])
                # tag the post with the agent
                post["agent_id"] = agent.id
                post["agent_name"] = agent.name
                post["llm_source"] = result["source"]

                agent.posts += 1
                agent.last_post_at = _now_iso()
                agent.last_content = result["content"]
                agent.last_source = result["source"]
                agent.last_quality = result["quality"]

                # Attribute earnings from THIS post only — proportional to
                # hook quality * network CPM * a synthetic reach factor.
                # This keeps leaderboard rankings meaningful and prevents
                # cumulative earnings from double-counting across agents.
                snap = ENGINE.network_state[network]
                reach = 800 + int(2400 * result["quality"])
                agent.total_impressions += reach
                agent.total_earnings += reach * (snap["cpm"] / 1000.0) * result["quality"]
            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa
                print(f"[swarm] agent {agent.name} tick error: {e}")

            try:
                await asyncio.sleep(agent.cadence_s)
            except asyncio.CancelledError:
                break

    def _build_prompt(self, agent: Agent, network: str, niche_label: str) -> str:
        seed = random.choice(PROMPT_LIBRARY)
        return (
            f"You are '{agent.name}'. Tone: {agent.tone}. Playbook: "
            f"{agent.playbook}. Task: write a single {network} post for the "
            f"{niche_label} niche. Angle: {seed}."
        )


SWARM = SwarmManager()
