"""
Production drivers — the layer that ACTUALLY talks to real platforms in
graduated mode. Everything here is a thin, guarded shim:

  * every method checks `MODE.can_use_*()` before doing anything
  * without credentials, the driver returns a structured "not_armed" payload
    instead of exploding
  * the sandbox engine keeps running regardless, so operators still see
    live attribution and can compare synthetic-vs-real side by side

Real Facebook Marketplace and real dropshipping-supplier APIs require
per-account onboarding + platform review — this file exposes the correct
integration seams so credentials can be dropped in later without any UI or
engine rewiring.
"""
from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import Any

from mode import MODE

try:  # optional — Termux only
    import subprocess
    HAS_SUBPROCESS = True
except Exception:
    HAS_SUBPROCESS = False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------
# Termux-API bridge (native toast + notification)
# ---------------------------------------------------------------------
def termux_toast(msg: str) -> None:
    if not HAS_SUBPROCESS:
        return
    try:
        subprocess.run(["termux-toast", "-s", msg], timeout=2, check=False)
    except FileNotFoundError:
        pass


def termux_notify(title: str, content: str) -> None:
    if not HAS_SUBPROCESS:
        return
    try:
        subprocess.run(
            ["termux-notification", "--title", title, "--content", content],
            timeout=2, check=False,
        )
    except FileNotFoundError:
        pass


# ---------------------------------------------------------------------
# Supplier driver — dropshipping order routing
# ---------------------------------------------------------------------
class SupplierDriver:
    """Placeholder for a real supplier API (CJ Dropshipping, Zendrop, etc).
    In graduated mode the operator would drop credentials in .env and this
    class would POST orders to the supplier. Until then, it returns a
    'not_armed' payload so callers can display a clear MOCKED status."""

    def __init__(self) -> None:
        self.endpoint = os.environ.get("DROPSHIP_SUPPLIER_URL", "")
        self.api_key = os.environ.get("DROPSHIP_SUPPLIER_KEY", "")

    def status(self) -> dict:
        return {
            "armed": MODE.can_use_dropdashin_supplier(),
            "endpoint_configured": bool(self.endpoint),
            "credentials_present": bool(self.api_key),
            "mode": MODE.state.mode,
        }

    async def place_order(self, order: dict) -> dict:
        if not MODE.can_use_dropdashin_supplier():
            return {
                "status": "not_armed",
                "reason": "graduated mode + dropdashin_supplier driver required",
                "mocked": True,
                "order": order,
                "ts": _now(),
            }
        # Real path would be an httpx.AsyncClient.post(...) here.
        # Left as an explicit MOCKED response until real credentials
        # exist — do NOT invent a fake success.
        return {
            "status": "mocked_real_path",
            "note": "credentials armed but supplier SDK not wired in MVP",
            "order": order,
            "ts": _now(),
        }


# ---------------------------------------------------------------------
# Facebook Marketplace driver — listing + inbox sync
# ---------------------------------------------------------------------
class FacebookMarketplaceDriver:
    def __init__(self) -> None:
        self.access_token = os.environ.get("FB_MARKETPLACE_TOKEN", "")
        self.page_id = os.environ.get("FB_PAGE_ID", "")

    def status(self) -> dict:
        return {
            "armed": MODE.can_use_facebook_marketplace(),
            "token_present": bool(self.access_token),
            "page_id_present": bool(self.page_id),
            "mode": MODE.state.mode,
        }

    async def publish_listing(self, listing: dict) -> dict:
        if not MODE.can_use_facebook_marketplace():
            return {
                "status": "not_armed",
                "reason": "graduated mode + facebook_marketplace driver required",
                "mocked": True,
                "listing": listing,
                "ts": _now(),
            }
        # Real path: Facebook Graph API listings endpoint.
        # Marketplace public listing APIs are gated behind commerce review;
        # once approved, replace this stub with the real call.
        termux_notify("Facebook Marketplace", f"Listing '{listing.get('title')}' queued")
        return {
            "status": "mocked_real_path",
            "note": "token armed but Marketplace API requires commerce review",
            "listing": listing,
            "ts": _now(),
        }


SUPPLIER = SupplierDriver()
FB_MP = FacebookMarketplaceDriver()
