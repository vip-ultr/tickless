"""Site visit analytics, backed by Supabase.

Privacy model: we never store raw IPs. Each visit records
sha256(daily_salt + ip), where the salt rotates per UTC day, so a
visitor is only linkable within a single day (enough for unique/day
counts) and hashes cannot be joined across days.

Gracefully disabled when Supabase is not configured: the beacon is a
no-op and admin stats return zeros.
"""
import hashlib
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request

from ads import _sb, require_admin

ANALYTICS_SALT = os.getenv("ANALYTICS_SALT", "tickless-analytics")

router = APIRouter()

_EMPTY_BUCKET = {"unique_visitors": 0, "total_visits": 0}
_EMPTY_STATS = {
    "today": dict(_EMPTY_BUCKET),
    "week": dict(_EMPTY_BUCKET),
    "month": dict(_EMPTY_BUCKET),
    "year": dict(_EMPTY_BUCKET),
    "daily": [],
}


def client_ip(request: Request) -> str:
    """Real client IP behind Render/Vercel proxies (first X-Forwarded-For hop)."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def visitor_hash(ip: str) -> str:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return hashlib.sha256(f"{ANALYTICS_SALT}:{day}:{ip}".encode()).hexdigest()[:32]


@router.post("/api/visit")
async def record_visit(request: Request):
    """Visit beacon called once per page load by the frontend."""
    sb = _sb()
    if sb:
        try:
            sb.rpc("record_visit", {"p_hash": visitor_hash(client_ip(request))}).execute()
        except Exception:
            # Analytics must never break the site.
            pass
    return {"ok": True}


@router.get("/api/admin/visits", dependencies=[Depends(require_admin)])
async def visit_stats():
    sb = _sb()
    if not sb:
        return _EMPTY_STATS
    try:
        res = sb.rpc("visit_stats", {}).execute()
        return res.data or _EMPTY_STATS
    except Exception:
        return _EMPTY_STATS
