"""Iteration 3 refactor regression — /api/state, engine ticking, dropdashin, flush, publish."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module", autouse=True)
def reset_state():
    requests.post(f"{API}/mode", json={"mode": "sandbox"})
    requests.post(f"{API}/swarm/stop_all")
    yield
    requests.post(f"{API}/mode", json={"mode": "sandbox"})
    requests.post(f"{API}/swarm/stop_all")


# --- /api/state shape ---
class TestState:
    def test_state_shape(self):
        r = requests.get(f"{API}/state")
        assert r.status_code == 200
        d = r.json()
        for k in ("tick", "totals", "networks", "dropdashin", "series", "mode", "swarm"):
            assert k in d, f"missing {k}"
        for k in ("earnings", "impressions", "clicks", "conversions", "conv_rate"):
            assert k in d["totals"], f"missing totals.{k}"
        assert len(d["networks"]) == 10, f"got {len(d['networks'])} networks"
        for k in ("orders", "gross_sales", "net_profit", "ad_spend", "stock", "recent_orders"):
            assert k in d["dropdashin"], f"missing dropdashin.{k}"

    def test_engine_ticks_and_earnings_grow(self):
        s1 = requests.get(f"{API}/state").json()
        time.sleep(5)
        s2 = requests.get(f"{API}/state").json()
        assert s2["tick"] > s1["tick"], f"tick did not advance: {s1['tick']} -> {s2['tick']}"
        assert s2["totals"]["earnings"] >= s1["totals"]["earnings"], "earnings decreased"


# --- analytics history ---
class TestHistory:
    def test_history_count(self):
        time.sleep(6)
        r = requests.get(f"{API}/analytics/history")
        assert r.status_code == 200
        assert r.json()["count"] >= 1


# --- flush ---
class TestFlush:
    def test_flush_resets_totals(self):
        r = requests.post(f"{API}/sandbox/flush")
        assert r.status_code == 200
        s = requests.get(f"{API}/state").json()
        # totals should be near-zero right after flush (engine may have ticked once)
        assert s["totals"]["earnings"] < 500, f"earnings not reset: {s['totals']['earnings']}"
        h = requests.get(f"{API}/analytics/history").json()
        assert h["count"] <= 2, f"history not cleared: {h['count']}"


# --- publish endpoint ---
class TestPublish:
    def test_publish_sim(self):
        r = requests.post(f"{API}/agents/publish", json={
            "network": "instagram", "prompt": "TEST_hello world", "use_llm": True,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "post" in d and d["post"].get("post_id")
        assert "llm" in d
        # sim/real source may live at top or nested under llm
        src = d["llm"].get("source") or d["llm"].get("provider")
        assert src in ("sim", "real", "openai", "anthropic", "gemini")


# --- dropdashin driver mocked ---
class TestDropdashinDriver:
    def test_order_not_armed(self):
        requests.post(f"{API}/mode", json={"mode": "sandbox"})
        r = requests.post(f"{API}/drivers/dropdashin/order",
                          json={"product": "test", "quantity": 1})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "not_armed"
        assert d["mocked"] is True
