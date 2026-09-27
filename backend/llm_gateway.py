"""
LLM Gateway — hybrid brain for OpenDroid agents.

Behavior is strictly gated by the global mode manager:

  sandbox   → always the deterministic `sim` synthesizer. Zero network calls,
              zero credits burned. Safe for practice runs.
  graduated → if `llm_real` is armed AND EMERGENT_LLM_KEY is set, calls the
              Emergent Universal Key via emergentintegrations. Otherwise
              falls back to `sim`.

Providers/models available in graduated mode:
    openai/gpt-5.4          (default, recommended)
    anthropic/claude-sonnet-4-6
    gemini/gemini-3.1-pro-preview
"""
from __future__ import annotations
import os
import random
import time
import uuid
from typing import Optional

from mode import MODE

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_EMERGENT = True
except Exception:
    HAS_EMERGENT = False


DEFAULT_MODELS = {
    "openai": "gpt-5.4",
    "anthropic": "claude-sonnet-4-6",
    "gemini": "gemini-3.1-pro-preview",
}


def _system_prompt(network: str, niche_label: str) -> str:
    return (
        f"You are a top-tier social growth agent posting on {network}.\n"
        f"Niche: {niche_label}. It is August 2026.\n"
        "Rules:\n"
        "- Write a single post, max 220 characters.\n"
        "- Open with a specific hook or number in the first 8 words.\n"
        "- No emojis at the start. No hashtags. No 'game-changer', "
        "'10x', 'leverage', 'revolutionary' — those get filtered.\n"
        "- End with a concrete CTA or receipt (DM keyword, link in bio, etc)."
    )


class LLMGateway:
    def __init__(self) -> None:
        self.emergent_key = os.environ.get("EMERGENT_LLM_KEY", "")
        # optional user-supplied keys (bypass Emergent, not used in MVP)
        self.openai_key = os.environ.get("OPENAI_API_KEY", "")
        self.anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
        self.groq_key = os.environ.get("GROQ_API_KEY", "")
        self.ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434/v1")

    # ------------------------------------------------------------------
    def status(self) -> dict:
        return {
            "mode": MODE.state.mode,
            "real_enabled": MODE.can_use_real_llm(),
            "emergent_key_present": bool(self.emergent_key),
            "sdk_installed": HAS_EMERGENT,
            "available_providers": (
                ["openai", "anthropic", "gemini"]
                if HAS_EMERGENT and self.emergent_key
                else []
            ),
            "default_models": DEFAULT_MODELS,
            "fallback": "sim",
        }

    # ------------------------------------------------------------------
    async def generate(
        self,
        prompt: str,
        network: str,
        niche_label: str,
        *,
        provider: str = "openai",
        model: Optional[str] = None,
    ) -> dict:
        """Return a dict {content, quality, provider, model, latency_ms,
        source}. `source` is 'sim' or 'real'."""
        t0 = time.time()

        content: Optional[str] = None
        used_provider = provider
        used_model = model or DEFAULT_MODELS.get(provider, "gpt-5.4")
        source = "sim"

        if MODE.can_use_real_llm() and HAS_EMERGENT and self.emergent_key:
            try:
                content = await self._call_emergent(
                    prompt, network, niche_label, provider, used_model
                )
                source = "real"
            except Exception as e:
                # any failure gracefully falls back — sandbox never breaks
                print(f"[llm] real provider failed, falling back: {e}")
                content = None

        if content is None:
            content = self._sim_generate(prompt, network, niche_label)
            used_provider = "sim"
            used_model = "deterministic-hook-v1"

        quality = self._score(content, network, niche_label)
        return {
            "content": content.strip(),
            "quality": round(quality, 3),
            "provider": used_provider,
            "model": used_model,
            "source": source,
            "latency_ms": int((time.time() - t0) * 1000),
        }

    async def _call_emergent(
        self, prompt: str, network: str, niche_label: str,
        provider: str, model: str,
    ) -> str:
        chat = LlmChat(
            api_key=self.emergent_key,
            session_id=f"opendroid-{uuid.uuid4().hex[:10]}",
            system_message=_system_prompt(network, niche_label),
        ).with_model(provider, model)
        result = await chat.send_message(UserMessage(text=prompt))
        # result may be a str or an object depending on SDK version
        if isinstance(result, str):
            return result
        return getattr(result, "content", str(result))

    # ------------------------------------------------------------------
    def _sim_generate(self, prompt: str, network: str, niche_label: str) -> str:
        seed = (prompt or "growth").strip()
        openers = [
            f"[{network.upper()}] {seed[:70]}",
            f"Playbook v{random.randint(2,9)}.{random.randint(0,9)} — {seed[:52]}",
            f"Field report • {niche_label} • {seed[:58]}",
        ]
        tails = [
            "→ tap the pinned comment for the funnel.",
            "→ DM 'AGENT' to trigger the flow.",
            "→ link in bio routes to Dropdashin store.",
            "→ receipts in the thread below.",
        ]
        return f"{random.choice(openers)} {random.choice(tails)}"

    def _score(self, content: str, network: str, niche_label: str) -> float:
        length_bonus = min(len(content) / 220, 1.0)
        specificity = sum(c.isdigit() for c in content) / 12
        cliche_penalty = 0.0
        for w in ("game-changer", "revolutionary", "leverage synergies",
                  "10x", "unlock", "crushing it"):
            if w in content.lower():
                cliche_penalty += 0.12
        base = 0.35 + 0.35 * length_bonus + 0.4 * min(specificity, 1.0)
        base -= cliche_penalty
        if network == "linkedin" and cliche_penalty > 0:
            base -= 0.15
        return max(0.05, min(0.99, base + random.uniform(-0.05, 0.05)))


GATEWAY = LLMGateway()
