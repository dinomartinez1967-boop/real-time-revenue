"""
Real-time analytics + Background Traffic Engine.

Ticks once per second. Emits:
  - aggregate metrics (revenue, impressions/sec, avg conversion)
  - per-network deltas
  - synthetic feed events (new posts, comments, sales)

State is in-memory so the sandbox is fast; a snapshot is written to Mongo
every ~10 seconds for durability but the engine itself never blocks on I/O.
"""
from __future__ import annotations
import asyncio
import math
import random
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any

from networks import (
    NETWORKS,
    NICHES,
    SYNTHETIC_AUTHORS,
    COMMENT_TEMPLATES,
    render_hook,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SandboxEngine:
    def __init__(self) -> None:
        self.started_at = time.time()
        self.tick = 0
        self.niche_key: str = "finance_saas_affiliate"
        self.total_earnings: float = 0.0
        self.total_impressions: int = 0
        self.total_clicks: int = 0
        self.total_conversions: int = 0

        # Per-network live state
        self.network_state: dict[str, dict[str, Any]] = {
            k: self._blank_network(k) for k in NETWORKS
        }
        # Dropdashin-specific ecommerce state
        self.dropdashin = {
            "stock": 500,
            "orders": 0,
            "gross_sales": 0.0,
            "net_profit": 0.0,
            "ad_spend": 0.0,
            "cart_abandoned": 0,
            "cart_recovered": 0,
            "product": {
                "name": "AI-Curated Ceramic Diffuser",
                "retail": 39.90,
                "wholesale": 8.20,
            },
            "recent_orders": deque(maxlen=25),
        }

        # Feeds — bounded deques so memory stays flat
        self.feeds: dict[str, deque] = {k: deque(maxlen=40) for k in NETWORKS}

        # Rolling time-series for the top chart (last 60 seconds)
        self.series: deque = deque(maxlen=90)

        # WebSocket subscribers
        self._subscribers_analytics: set[asyncio.Queue] = set()
        self._subscribers_feed: set[asyncio.Queue] = set()

        # Seed each feed with an initial post so the UI never looks empty.
        for k in NETWORKS:
            self._spawn_post(k, seeded=True)

    # ------------------------------------------------------------------
    def _blank_network(self, key: str) -> dict[str, Any]:
        n = NETWORKS[key]
        return {
            "impressions": 0,
            "clicks": 0,
            "conversions": 0,
            "earnings": 0.0,
            "hook_score": random.uniform(0.35, 0.7),
            "cpm": n["base_cpm"],
            "ctr": n["base_ctr"],
            "algo": {v: 0.0 for v in n["algo_vars"]},
            "banned": False,
            "posts": 0,
        }

    def snapshot_networks(self) -> list[dict[str, Any]]:
        out = []
        for k, meta in NETWORKS.items():
            s = self.network_state[k]
            out.append({
                "key": k,
                "name": meta["name"],
                "handle": meta["handle"],
                "color": meta["color"],
                "icon": meta["icon"],
                "impressions": s["impressions"],
                "clicks": s["clicks"],
                "conversions": s["conversions"],
                "earnings": round(s["earnings"], 2),
                "hook_score": round(s["hook_score"], 2),
                "cpm": round(s["cpm"], 2),
                "ctr": round(s["ctr"], 4),
                "algo": {k2: round(v, 2) for k2, v in s["algo"].items()},
                "banned": s["banned"],
                "posts": s["posts"],
            })
        return out

    def snapshot(self) -> dict[str, Any]:
        niche = NICHES[self.niche_key]
        return {
            "ts": _now_iso(),
            "tick": self.tick,
            "uptime_s": int(time.time() - self.started_at),
            "niche": {"key": self.niche_key, **niche},
            "totals": {
                "earnings": round(self.total_earnings, 2),
                "impressions": self.total_impressions,
                "clicks": self.total_clicks,
                "conversions": self.total_conversions,
                "conv_rate": (
                    round(self.total_conversions / max(1, self.total_clicks), 4)
                ),
            },
            "series": list(self.series),
            "networks": self.snapshot_networks(),
            "dropdashin": {
                **{k: v for k, v in self.dropdashin.items()
                   if k not in ("recent_orders",)},
                "recent_orders": list(self.dropdashin["recent_orders"]),
            },
        }

    # ------------------------------------------------------------------
    # Public control API
    # ------------------------------------------------------------------
    def set_niche(self, key: str) -> None:
        if key in NICHES:
            self.niche_key = key

    def flush_sandbox(self) -> None:
        """Reset ephemeral market state without killing the server."""
        self.total_earnings = 0.0
        self.total_impressions = 0
        self.total_clicks = 0
        self.total_conversions = 0
        for k in NETWORKS:
            self.network_state[k] = self._blank_network(k)
            self.feeds[k].clear()
            self._spawn_post(k, seeded=True)
        self.dropdashin.update({
            "stock": 500,
            "orders": 0,
            "gross_sales": 0.0,
            "net_profit": 0.0,
            "ad_spend": 0.0,
            "cart_abandoned": 0,
            "cart_recovered": 0,
        })
        self.dropdashin["recent_orders"].clear()
        self.series.clear()

    def publish(self, network_key: str, content: str, quality: float) -> dict:
        """An agent (or the operator) publishes to a network. The engine
        immediately gives it a hook score and a fresh entry in the feed. The
        background loop will then generate traffic against it."""
        if network_key not in NETWORKS:
            raise ValueError("unknown network")
        st = self.network_state[network_key]
        st["hook_score"] = max(0.05, min(0.99, 0.4 * st["hook_score"] + 0.6 * quality))
        st["posts"] += 1

        post = self._spawn_post(network_key, content=content, quality=quality)
        return post

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _spawn_post(self, key: str, *, content: str | None = None,
                    quality: float | None = None, seeded: bool = False) -> dict:
        niche = NICHES[self.niche_key]
        author = random.choice(SYNTHETIC_AUTHORS)
        text = content or render_hook(niche["label"])
        q = quality if quality is not None else random.uniform(0.3, 0.85)
        post = {
            "post_id": uuid.uuid4().hex[:12],
            "network": key,
            "author": author,
            "author_metrics": {
                "followers": random.randint(1_200, 480_000),
                "verified": random.random() < 0.18,
            },
            "content": text,
            "created_at": _now_iso(),
            "algorithmic_weight": round(q, 3),
            "sentiment_index": round(random.uniform(-0.2, 0.9), 2),
            "conversion_tracking_pixel": f"pxl_{uuid.uuid4().hex[:8]}",
            "seeded": seeded,
            "stats": {"views": 0, "likes": 0, "comments": 0, "shares": 0, "clicks": 0},
            "comments": [],
        }
        self.feeds[key].appendleft(post)
        return post

    async def _emit_feed(self, event: dict) -> None:
        for q in list(self._subscribers_feed):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    async def _emit_analytics(self, event: dict) -> None:
        for q in list(self._subscribers_analytics):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    def subscribe_analytics(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        self._subscribers_analytics.add(q)
        return q

    def unsubscribe_analytics(self, q: asyncio.Queue) -> None:
        self._subscribers_analytics.discard(q)

    def subscribe_feed(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=128)
        self._subscribers_feed.add(q)
        return q

    def unsubscribe_feed(self, q: asyncio.Queue) -> None:
        self._subscribers_feed.discard(q)

    # ------------------------------------------------------------------
    async def run(self) -> None:
        """Main 1-second tick loop."""
        while True:
            try:
                await self._tick()
            except Exception as e:  # noqa
                # never let the engine die
                print(f"[engine] tick error: {e}")
            await asyncio.sleep(1.0)

    async def _tick(self) -> None:
        self.tick += 1
        niche = NICHES[self.niche_key]

        # Simulated hour of day drives CPM fluctuation (24h loop in 4 real min)
        sim_hour = (time.time() / 10) % 24
        daypart = 0.75 + 0.55 * math.sin((sim_hour - 6) / 24 * 2 * math.pi)

        deltas = await self._tick_networks(niche, daypart)
        drop_earn = self._tick_dropdashin(niche)
        deltas["earn"] += drop_earn

        self._commit_totals(deltas)
        await self._emit_analytics_tick(deltas)

    # ------------------------------------------------------------------
    # Per-tick helpers (extracted from _tick for readability + testability)
    # ------------------------------------------------------------------
    async def _tick_networks(self, niche: dict, daypart: float) -> dict:
        """Advance all 10 networks one second. Returns aggregated deltas."""
        totals = {"earn": 0.0, "imp": 0, "click": 0, "conv": 0}
        for key, meta in NETWORKS.items():
            st = self.network_state[key]
            if st["banned"]:
                if random.random() < 0.06:
                    st["banned"] = False
                continue

            imp, clicks, conv, earn = self._network_step(key, meta, st, niche, daypart)

            await self._maybe_ban(key, meta, st)
            st["impressions"] += imp
            st["clicks"] += clicks
            st["conversions"] += conv
            st["earnings"] += earn
            self._update_algo_vars(st, meta)

            totals["earn"] += earn
            totals["imp"] += imp
            totals["click"] += clicks
            totals["conv"] += conv

            if self.feeds[key] and self.tick % random.randint(5, 11) == 0:
                self._add_synthetic_comment(key)
            if self.tick % random.randint(20, 40) == 0:
                new_post = self._spawn_post(key)
                await self._emit_feed({
                    "type": "post", "network": key, "post": new_post,
                    "ts": _now_iso(),
                })
        return totals

    def _network_step(self, key: str, meta: dict, st: dict, niche: dict,
                      daypart: float) -> tuple[int, int, int, float]:
        """Compute (imp, clicks, conv, earn) for a single network this tick."""
        hook = st["hook_score"]
        st["cpm"] = max(0.5, meta["base_cpm"] * niche["cpm_mult"] * daypart
                        * (0.7 + hook * 0.9))
        st["ctr"] = max(0.001, meta["base_ctr"] * niche["ctr_mult"]
                        * (0.6 + hook * 1.1))
        base_imp = 40 + int(300 * meta["virality"] * hook)
        imp = int(base_imp * random.uniform(0.7, 1.35))
        earn = 0.0 if meta.get("ecommerce") else imp * (st["cpm"] / 1000.0)
        clicks = int(imp * st["ctr"])
        # Stochastic rounding so we don't lose fractional conversions
        expected_conv = clicks * niche["conversion_rate"] * (0.6 + hook)
        conv = int(expected_conv) + (
            1 if random.random() < (expected_conv - int(expected_conv)) else 0
        )
        earn += conv * niche["product_value"] * 0.35  # affiliate cut
        return imp, clicks, conv, earn

    async def _maybe_ban(self, key: str, meta: dict, st: dict) -> None:
        if (
            meta.get("ban_risk")
            and st["hook_score"] < 0.35
            and random.random() < meta["ban_risk"]
        ):
            st["banned"] = True
            await self._emit_feed({
                "type": "ban", "network": key,
                "reason": "Karma_Filter_Threshold below limit — subreddit auto-mod strike",
                "ts": _now_iso(),
            })

    def _update_algo_vars(self, st: dict, meta: dict) -> None:
        hook = st["hook_score"]
        for v in st["algo"]:
            st["algo"][v] = self._algo_value(v, hook)

    def _algo_value(self, name: str, hook: float) -> float:
        if name == "Hook_Time_MS":
            return 500 + hook * 2200
        if name == "AVD":
            return 30 + hook * 380
        if name == "Open_Rate":
            return 0.6 + hook * 0.35
        if name == "Churn_Rate":
            return max(0.01, 0.15 - hook * 0.12)
        if name == "Velocity_Score":
            return hook * random.uniform(0.8, 1.2)
        if name == "Product_Saturation_Index":
            return min(0.98, 0.4 + math.sin(self.tick / 40) * 0.3 + 0.2)
        if name == "AI_Description_Conversion_Vector":
            return 0.8 + hook * 0.6
        if name == "Supplier_Latency_MS":
            return 220 + random.randint(0, 480)
        if name == "Cart_Abandonment_Rate":
            return max(0.15, 0.55 - hook * 0.25)
        return round(random.uniform(0.4, 1.0) * (0.6 + hook), 2)

    def _tick_dropdashin(self, niche: dict) -> float:
        """Advance the Dropdashin e-commerce sim. Returns earnings delta."""
        d = self.dropdashin
        ig_hook = self.network_state["instagram"]["hook_score"]
        tt_hook = self.network_state["tiktok"]["hook_score"]
        cross_traffic_hook = (ig_hook + tt_hook) / 2
        potential = int(60 + 400 * cross_traffic_hook * random.uniform(0.6, 1.4))
        buyers = int(potential * 0.028 * (0.5 + cross_traffic_hook))
        abandoned = int(potential * 0.55 * (0.4 + (1 - cross_traffic_hook) * 0.6))
        recovered = int(abandoned * 0.18 * cross_traffic_hook)

        earn_delta = 0.0
        if buyers > 0 and d["stock"] > 0:
            buyers = min(buyers, d["stock"])
            d["stock"] -= buyers
            d["orders"] += buyers
            gross = buyers * d["product"]["retail"]
            cost = buyers * d["product"]["wholesale"]
            ad_spend = potential * 0.008 * niche["cpm_mult"]
            d["gross_sales"] += gross
            d["ad_spend"] += ad_spend
            d["net_profit"] += (gross - cost) - ad_spend
            for _ in range(min(3, buyers)):
                d["recent_orders"].appendleft({
                    "id": uuid.uuid4().hex[:8].upper(),
                    "amount": d["product"]["retail"],
                    "from": random.choice([
                        "Instagram Reels", "TikTok Shop", "YouTube Desc",
                        "Threads", "X Post", "Reddit Thread",
                    ]),
                    "ts": _now_iso(),
                })
            earn_delta = (gross - cost) - ad_spend

        d["cart_abandoned"] += abandoned
        d["cart_recovered"] += recovered
        if d["stock"] < 30 and self.tick % 15 == 0:
            d["stock"] += 200
        return earn_delta

    def _commit_totals(self, deltas: dict) -> None:
        self.total_earnings += deltas["earn"]
        self.total_impressions += deltas["imp"]
        self.total_clicks += deltas["click"]
        self.total_conversions += deltas["conv"]
        self.series.append({
            "t": self.tick,
            "earnings_delta": round(deltas["earn"], 2),
            "earnings_total": round(self.total_earnings, 2),
            "imp_per_sec": deltas["imp"],
            "conv_rate": round(deltas["conv"] / max(1, deltas["click"]), 4),
        })

    async def _emit_analytics_tick(self, deltas: dict) -> None:
        await self._emit_analytics({
            "type": "tick",
            "ts": _now_iso(),
            "delta": {
                "earnings": round(deltas["earn"], 2),
                "impressions": deltas["imp"],
                "clicks": deltas["click"],
                "conversions": deltas["conv"],
            },
            "totals": {
                "earnings": round(self.total_earnings, 2),
                "impressions": self.total_impressions,
                "clicks": self.total_clicks,
                "conversions": self.total_conversions,
                "conv_rate": round(
                    self.total_conversions / max(1, self.total_clicks), 4
                ),
            },
            "networks": self.snapshot_networks(),
            "dropdashin": {
                **{k: v for k, v in self.dropdashin.items()
                   if k not in ("recent_orders",)},
                "recent_orders": list(self.dropdashin["recent_orders"])[:5],
            },
            "series_point": self.series[-1],
        })

    def _add_synthetic_comment(self, key: str) -> None:
        st = self.network_state[key]
        post = self.feeds[key][0]
        hook = st["hook_score"]
        if key == "dropdashin":
            bucket = "buyer" if random.random() < 0.6 else "positive"
        elif hook > 0.7:
            bucket = "positive" if random.random() < 0.85 else "neutral"
        elif hook > 0.45:
            bucket = random.choices(["positive", "neutral", "negative"],
                                    weights=[0.55, 0.3, 0.15])[0]
        else:
            bucket = random.choices(["neutral", "negative", "positive"],
                                    weights=[0.4, 0.45, 0.15])[0]

        comment = {
            "id": uuid.uuid4().hex[:8],
            "author": random.choice(SYNTHETIC_AUTHORS),
            "text": random.choice(COMMENT_TEMPLATES[bucket]),
            "sentiment": bucket,
            "ts": _now_iso(),
        }
        post["comments"].insert(0, comment)
        post["comments"] = post["comments"][:8]
        post["stats"]["comments"] += 1
        post["stats"]["likes"] += random.randint(3, 42)
        post["stats"]["views"] += random.randint(120, 900)
        post["stats"]["shares"] += random.randint(0, 4)


ENGINE = SandboxEngine()
