"""
Global sandbox / graduated mode toggle.

    sandbox    → everything is synthetic. LLM calls fall back to `sim`.
                 Production drivers refuse to run. Safe by default.
    graduated  → real LLM providers (via Emergent Universal Key) are enabled.
                 Production drivers can be armed with real credentials.
                 The synthetic engine still runs so operators can see live
                 attribution, but any side-effect that would touch a real
                 platform is guarded by the driver's `enabled` flag.

State is intentionally in-memory + snapshotted to Mongo, so a restart
doesn't silently promote the sandbox to graduated mode.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Literal


Mode = Literal["sandbox", "graduated"]


@dataclass
class ModeState:
    mode: Mode = "sandbox"
    # Which drivers are armed. Sandbox mode forces all to False.
    drivers: dict = field(
        default_factory=lambda: {
            "llm_real": False,
            "dropdashin_supplier": False,
            "facebook_marketplace": False,
        }
    )
    # Human-readable safety banner
    banner: str = "SANDBOX — all activity is synthetic. No external calls."

    def to_dict(self) -> dict:
        return asdict(self)


class ModeManager:
    def __init__(self) -> None:
        self.state = ModeState()

    def set_mode(self, mode: Mode) -> ModeState:
        if mode not in ("sandbox", "graduated"):
            raise ValueError("mode must be 'sandbox' or 'graduated'")
        self.state.mode = mode
        if mode == "sandbox":
            # sandbox force-disables every real driver as a safety rail
            for k in self.state.drivers:
                self.state.drivers[k] = False
            self.state.banner = (
                "SANDBOX — all activity is synthetic. No external calls."
            )
        else:
            self.state.banner = (
                "GRADUATED — real drivers may be armed. Verify credentials."
            )
        return self.state

    def arm_driver(self, name: str, on: bool) -> ModeState:
        if name not in self.state.drivers:
            raise ValueError(f"unknown driver: {name}")
        if self.state.mode != "graduated" and on:
            raise ValueError(
                "cannot arm drivers in sandbox mode — switch to graduated first"
            )
        self.state.drivers[name] = on
        return self.state

    def can_use_real_llm(self) -> bool:
        return self.state.mode == "graduated" and self.state.drivers["llm_real"]

    def can_use_dropdashin_supplier(self) -> bool:
        return (
            self.state.mode == "graduated"
            and self.state.drivers["dropdashin_supplier"]
        )

    def can_use_facebook_marketplace(self) -> bool:
        return (
            self.state.mode == "graduated"
            and self.state.drivers["facebook_marketplace"]
        )


MODE = ModeManager()
