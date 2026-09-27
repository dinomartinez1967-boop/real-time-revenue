"""Iteration 2 backend tests — mode, swarm, drivers, LLM, analytics history, WS."""
import os
import json
import time
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to reading frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module", autouse=True)
def reset_state():
    # ensure sandbox mode at start
    requests.post(f"{API}/mode", json={"mode": "sandbox"})
    requests.post(f"{API}/swarm/stop_all")
    yield
    requests.post(f"{API}/mode", json={"mode": "sandbox"})
    requests.post(f"{API}/swarm/stop_all")


# ------------------- MODE -------------------
class TestMode:
    def test_get_mode_default_sandbox(self):
        r = requests.get(f"{API}/mode")
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "sandbox"
        assert d["drivers"]["llm_real"] is False
        assert d["drivers"]["dropdashin_supplier"] is False
        assert d["drivers"]["facebook_marketplace"] is False

    def test_arm_llm_fails_in_sandbox(self):
        r = requests.post(f"{API}/drivers/arm", json={"driver": "llm_real", "on": True})
        assert r.status_code == 400

    def test_switch_to_graduated(self):
        r = requests.post(f"{API}/mode", json={"mode": "graduated"})
        assert r.status_code == 200
        assert r.json()["mode"] == "graduated"

    def test_arm_llm_succeeds_in_graduated(self):
        r = requests.post(f"{API}/drivers/arm", json={"driver": "llm_real", "on": True})
        assert r.status_code == 200
        assert r.json()["drivers"]["llm_real"] is True

    def test_sandbox_disarms_all(self):
        # arm supplier too
        requests.post(f"{API}/drivers/arm", json={"driver": "dropdashin_supplier", "on": True})
        # spawn agent to verify swarm stops
        requests.post(f"{API}/swarm/agents", json={
            "name": "TEST_pre_disarm", "playbook": "test",
            "target_networks": ["instagram"], "provider": "openai", "cadence_s": 5,
        })
        r = requests.post(f"{API}/mode", json={"mode": "sandbox"})
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "sandbox"
        assert all(v is False for v in d["drivers"].values())
        # swarm should be empty
        agents = requests.get(f"{API}/swarm/agents").json()
        assert agents["count"] == 0


# ------------------- LLM STATUS -------------------
class TestLLMStatus:
    def test_status_sandbox(self):
        requests.post(f"{API}/mode", json={"mode": "sandbox"})
        r = requests.get(f"{API}/llm/status")
        assert r.status_code == 200
        d = r.json()
        assert d["real_enabled"] is False
        assert d["emergent_key_present"] is True

    def test_status_graduated_armed(self):
        requests.post(f"{API}/mode", json={"mode": "graduated"})
        requests.post(f"{API}/drivers/arm", json={"driver": "llm_real", "on": True})
        d = requests.get(f"{API}/llm/status").json()
        assert d["real_enabled"] is True
        assert d["emergent_key_present"] is True
        assert set(d["available_providers"]) >= {"openai", "anthropic", "gemini"}


# ------------------- SWARM -------------------
class TestSwarm:
    def test_spawn_agent(self):
        requests.post(f"{API}/mode", json={"mode": "sandbox"})
        r = requests.post(f"{API}/swarm/agents", json={
            "name": "TEST_alpha", "playbook": "punchy hooks",
            "target_networks": ["instagram", "tiktok"],
            "provider": "openai", "cadence_s": 6,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and d["playbook"] == "punchy hooks"
        assert d["provider"] == "openai"
        # leaderboard reflects
        lb = requests.get(f"{API}/swarm/agents").json()
        assert lb["count"] >= 1
        ids = [a["id"] for a in lb["agents"]]
        assert d["id"] in ids

    def test_sandbox_agent_stays_sim(self):
        # wait for agent to tick
        time.sleep(8)
        lb = requests.get(f"{API}/swarm/agents").json()
        agents = [a for a in lb["agents"] if a["name"] == "TEST_alpha"]
        assert agents, "TEST_alpha not found"
        a = agents[0]
        # in sandbox last_source must be sim
        assert a["last_source"] == "sim", f"got {a['last_source']}"

    def test_delete_agent(self):
        lb = requests.get(f"{API}/swarm/agents").json()
        target = [a for a in lb["agents"] if a["name"] == "TEST_alpha"][0]
        r = requests.delete(f"{API}/swarm/agents/{target['id']}")
        assert r.status_code == 200
        lb2 = requests.get(f"{API}/swarm/agents").json()
        assert target["id"] not in [a["id"] for a in lb2["agents"]]

    def test_stop_all(self):
        requests.post(f"{API}/swarm/agents", json={
            "name": "TEST_x", "playbook": "p",
            "target_networks": ["instagram"], "provider": "openai", "cadence_s": 8,
        })
        r = requests.post(f"{API}/swarm/stop_all")
        assert r.status_code == 200
        assert requests.get(f"{API}/swarm/agents").json()["count"] == 0

    def test_real_llm_agent(self):
        """Spawn in graduated + llm_real armed and expect last_source=real after wait."""
        requests.post(f"{API}/mode", json={"mode": "graduated"})
        requests.post(f"{API}/drivers/arm", json={"driver": "llm_real", "on": True})
        r = requests.post(f"{API}/swarm/agents", json={
            "name": "TEST_real", "playbook": "real llm test",
            "target_networks": ["instagram"], "provider": "openai", "cadence_s": 5,
        })
        assert r.status_code == 200
        aid = r.json()["id"]
        # wait for at least one tick incl. real LLM call
        got_real = False
        for _ in range(6):
            time.sleep(3)
            lb = requests.get(f"{API}/swarm/agents").json()
            a = next((x for x in lb["agents"] if x["id"] == aid), None)
            if a and a["last_source"] == "real" and a["last_content"]:
                got_real = True
                break
        # cleanup
        requests.delete(f"{API}/swarm/agents/{aid}")
        requests.post(f"{API}/mode", json={"mode": "sandbox"})
        assert got_real, "agent did not produce real LLM content within timeout"


# ------------------- DRIVERS -------------------
class TestDrivers:
    def test_drivers_status(self):
        r = requests.get(f"{API}/drivers/status")
        assert r.status_code == 200
        d = r.json()
        assert "supplier" in d and "facebook_marketplace" in d and "mode" in d

    def test_dropdashin_order_not_armed(self):
        requests.post(f"{API}/mode", json={"mode": "sandbox"})
        r = requests.post(f"{API}/drivers/dropdashin/order",
                          json={"product": "test", "quantity": 1})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "not_armed"
        assert d["mocked"] is True

    def test_facebook_listing_not_armed(self):
        r = requests.post(f"{API}/drivers/facebook/listing",
                          json={"title": "test", "price": 9.99})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "not_armed"
        assert d["mocked"] is True


# ------------------- ANALYTICS HISTORY -------------------
class TestAnalyticsHistory:
    def test_history_returns_series(self):
        # server needs a few snapshot cycles (5s each)
        time.sleep(6)
        r = requests.get(f"{API}/analytics/history")
        assert r.status_code == 200
        d = r.json()
        assert d["count"] > 0
        row = d["series"][0]
        for k in ("tick", "totals", "niche", "mode"):
            assert k in row, f"missing {k} in {row}"


# ------------------- WEBSOCKET -------------------
class TestWebsocket:
    def test_ws_analytics_swarm_and_mode(self):
        async def run():
            ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/analytics"
            async with websockets.connect(ws_url) as ws:
                snap = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                assert snap.get("type") == "snapshot"
                assert "swarm" in snap and "mode" in snap
                # get next tick
                tick = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
                assert "swarm" in tick
                assert "mode" in tick
                assert isinstance(tick["mode"], str)
        asyncio.run(run())
