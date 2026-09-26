#!/data/data/com.termux/files/usr/bin/env python3
"""flush_sandbox.py — reset simulated sales & restock Dropdashin without
tearing down the running FastAPI server. Safe to run at any time.

Usage:
    python flush_sandbox.py           # local dev
    OPENDROID_API=http://192.168.1.5:8001/api python flush_sandbox.py
"""
import os
import sys
import urllib.request
import json


def main() -> int:
    base = os.environ.get("OPENDROID_API", "http://localhost:8001/api")
    url = f"{base}/sandbox/flush"
    req = urllib.request.Request(url, method="POST", data=b"", headers={
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            payload = json.loads(r.read().decode())
    except Exception as e:
        print(f"[flush_sandbox] FAILED: {e}", file=sys.stderr)
        return 1
    print(f"[flush_sandbox] ok — {payload}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
