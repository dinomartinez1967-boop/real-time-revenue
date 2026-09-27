# OpenDroid Sandbox — PRD

## Problem statement
Build an OpenDroid-style Android Sandbox Automation Framework that simulates
10 social networks + an AI Dropshipping store (Dropdashin, replacing Telegram
Business), driven by a 1Hz async engine and streamed to a terminal-styled
React Command Center via WebSocket. August 2026 growth-hacking trends.

## Architecture
- **Backend**: FastAPI + async engine (`simulation.py`, `networks.py`,
  `llm_gateway.py`) + MongoDB snapshot. Two WebSocket channels
  (`/api/ws/analytics`, `/api/ws/feed`). All routes under `/api`.
- **Frontend**: React 19 + Tailwind + Recharts + sonner. JetBrains Mono,
  neon green (#00FF66) + cyan (#00F0FF).
- **Termux**: pure-Python backend, `scripts/check_status.sh`,
  `scripts/flush_sandbox.py`, `scripts/logs_stream.sh`, `README.termux.md`
  with Phantom Process Killer bypass + Termux-API bridge instructions.

## Personas
- **Operator**: growth hacker running multi-agent experiments before
  graduating to real APIs. Uses Samsung DeX + Termux.
- **Agent**: LLM (or deterministic sim) that publishes into networks.

## Core requirements (static)
- 10 networks with unique algo variables (Group_Trust_Score, Hook_Time_MS,
  CTR_Thumbnail/AVD, Velocity_Score, Sound_Trend_Match, Churn_Rate/Open_Rate,
  Corporate_Authority_Index, Karma_Filter_Threshold, Instagram_Bridge_Traffic,
  Dropdashin's 4 e-commerce vectors).
- 4 niches with dynamic CPM & CTR multipliers, hybrid motor (fixed default
  Finance/SaaS/Affiliate + live switcher).
- Revenue: `impressions * (cpm_dyn/1000) + clicks*ctr*conv*product`.
  Stochastic rounding preserves fractional conversions.
- Dropdashin: `net_profit = sales*(retail-wholesale) - ad_spend` with
  cross-platform pixel attribution.

## Implemented (2026-02)
- ✅ 10-network async engine w/ per-tick synthetic traffic + comments
- ✅ 4-niche hybrid market motor with live swap
- ✅ WebSocket 1Hz analytics (snapshot + tick)
- ✅ REST: /state, /networks, /niches, /feed/{n}, /agents/publish, /sandbox/flush, /llm/status
- ✅ LLM Gateway with sim fallback + slots for Ollama/OpenAI/Anthropic/Groq
- ✅ Command Center UI (sidebar, niche selector, top metrics, live chart, feed, Dropdashin panel)
- ✅ Termux docs + 3 CLI scripts + Phantom Process Killer notes
- ✅ 100% backend + 100% frontend smoke tests

## Iteration 2 (2026-02)
- ✅ **Sandbox / Graduated mode toggle** with hard safety rail
  (sandbox force-disarms all real drivers and halts the swarm)
- ✅ **Real LLM Brains** via Emergent Universal Key: GPT-5.4 / Claude
  Sonnet 4.6 / Gemini 3.1 Pro. Only active when
  mode=graduated + llm_real driver armed. Sandbox always uses `sim`.
- ✅ **Multi-Agent Swarm** — spawn N agents with playbooks/tones/target-
  networks/cadence/provider. Live leaderboard sorted by earnings.
  Provider preselectable even in sandbox (kicks in on graduation).
- ✅ **Analytics History** persisted to Mongo every 5s, capped at ~1500
  points; loaded on Command Center mount so revenue/traffic curves
  survive refresh.
- ✅ **Production drivers**: `SupplierDriver`, `FacebookMarketplaceDriver`
  — guarded stubs that return structured `not_armed` / `mocked` payloads
  until real credentials are wired. Never side-effect in sandbox.
- ✅ 17/17 backend + 100% frontend iteration-2 tests pass

## Backlog
- P1: Bind real LLM providers end-to-end (Ollama/OpenAI/Anthropic/Groq)
- P1: Persist historical time series and expose /api/analytics/history
- P1: Multi-agent orchestration UI (spawn N agents with distinct playbooks)
- P2: Real Android screen automation driver for "Graduated Mode"
- P2: Cross-network A/B experiment scheduler
