"""Ad system: public ad serving + admin CRUD, backed by Supabase.

Gracefully disabled when SUPABASE_URL is not configured:
  - GET /api/ads returns [] (frontend renders nothing)
  - admin routes return 503

Visitors can cancel ads for the current page load. That state is deliberately
ephemeral and process-local -- see the page-load-scoped cancellation section.
"""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Response,
    UploadFile,
)
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
ADS_BUCKET = os.getenv("SUPABASE_ADS_BUCKET", "ad-creatives")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "")

VALID_SLOTS = {"leaderboard", "in_content", "result"}

router = APIRouter()

_client = None


def _sb():
    """Lazy Supabase client. None when unconfigured."""
    global _client
    if _client is None and SUPABASE_URL and SUPABASE_KEY:
        from supabase import create_client
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def _require_configured():
    sb = _sb()
    if not sb:
        raise HTTPException(status_code=503, detail="Ad system not configured.")
    return sb


# ---------------------------------------- page-load-scoped cancellation

# Cancellation lasts exactly one page load. The client mints a token, keeps it
# in module scope and never writes it anywhere, so reloading presents a token
# this store has never seen and the ads come straight back -- which is the
# product rule ("the ad should come back when the user reloads"). Nothing here
# is tied to IP or to a login, because either would leak the cancellation into
# later page loads.
#
# _DISMISS_TTL is memory hygiene, not the product rule: the reset on reload
# comes from the client minting a fresh token, so a record that outlives its
# page view is simply unreachable until it prunes.
#
# Held in process memory rather than Supabase: this is per-page-view state, not
# catalogue data, so it should evaporate on restart and must never accumulate
# rows. Render's free tier is single-instance, so a dict is the right store here.

_DISMISS_TTL = 12 * 60 * 60  # seconds; purely how long an orphaned record lingers
_DISMISS_MAX = 10_000        # hard cap so an unauthenticated flood cannot grow memory
_dismissed: dict[str, float] = {}  # page-load token -> expiry (epoch seconds)


def _prune_dismissals(now: float) -> None:
    """Drop expired entries, then the oldest, so the map stays bounded."""
    for sid in [s for s, exp in _dismissed.items() if exp <= now]:
        _dismissed.pop(sid, None)
    if len(_dismissed) <= _DISMISS_MAX:
        return
    # dict preserves insertion order, so the leading keys are the oldest.
    overflow = len(_dismissed) - _DISMISS_MAX
    for sid in list(_dismissed)[:overflow]:
        _dismissed.pop(sid, None)


def _session_id(raw: str | None) -> str | None:
    """Normalise a client-supplied page-load token; None when unusable."""
    if not raw:
        return None
    sid = raw.strip()[:64]
    return sid or None


def _is_dismissed(session: str) -> bool:
    """True while this page load's cancellation is still live."""
    now = time.time()
    exp = _dismissed.get(session)
    if exp is None:
        return False
    if exp <= now:
        _dismissed.pop(session, None)
        return False
    return True


class DismissRequest(BaseModel):
    session: str


# ---------------------------------------------------------------- auth

def _make_token() -> str:
    return jwt.encode(
        {"sub": ADMIN_USERNAME, "exp": int(time.time()) + 60 * 60 * 12},
        JWT_SECRET,
        algorithm="HS256",
    )


def require_admin(authorization: str | None = Header(default=None)):
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="Admin not configured.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized.")
    try:
        jwt.decode(authorization.removeprefix("Bearer "), JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Unauthorized.")


@router.post("/api/admin/login")
async def admin_login(username: str = Form(...), password: str = Form(...)):
    if not (ADMIN_USERNAME and ADMIN_PASSWORD and JWT_SECRET):
        raise HTTPException(status_code=503, detail="Admin not configured.")
    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Wrong username or password.")
    return {"token": _make_token()}


# ---------------------------------------------------------------- public

# Active ads change only when an admin publishes, unpublishes or deletes one,
# but they are read on every page view and once per page by the frontend. The
# Supabase read is not the expensive part -- measured end to end it is only
# ~60-140ms more than a no-op health check on the same connection -- but it was
# being paid on every request AND on the event loop, because supabase-py is
# synchronous while these handlers are async. The cache removes the repeat cost
# and run_in_threadpool removes the blocking (which is what made the whole
# instance feel intermittently slow: one ad read stalled every other request).
# The TTL is only a safety net, since admin CRUD invalidates immediately.
_ADS_TTL = 60.0
_ads_cache: tuple[float, list] | None = None  # (expiry epoch, rows)


def _invalidate_ads() -> None:
    """Drop the cached catalogue so a publish takes effect immediately."""
    global _ads_cache
    _ads_cache = None


def _parse_ts(value, *, end: bool = False) -> datetime | None:
    """Parse a Supabase `timestamptz` into an aware datetime, or None.

    A missing or unparseable value yields None, which the caller treats as
    "no bound" -- see `_within_flight`.

    `end=True` additionally means the value is a bare date, in which case it
    is pushed to the end of that day. The admin form writes `YYYY-MM-DD`, so
    without this a campaign sold as "1-7 Oct" would switch itself off at
    midnight before the 7th started, and the operator would be the one
    discovering the off-by-one. Times written with an explicit component are
    taken literally and remain exclusive.
    """
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        if not text:
            return None
        bare_date = len(text) == 10 and "T" not in text and " " not in text
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
        if bare_date and end:
            parsed = parsed + timedelta(days=1)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _within_flight(row: dict, now: datetime | None = None) -> bool:
    """True when `row`'s campaign window contains `now`.

    House ads leave `starts_at`/`ends_at` empty and must never be filtered
    out, so a NULL bound -- or one we cannot parse -- means open-ended. The
    failure mode is deliberately asymmetric: a bad timestamp shows an ad a
    little long, whereas a bad timestamp that hid a row would silently stop
    an advertiser's paid campaign.
    """
    now = now or datetime.now(timezone.utc)
    starts = _parse_ts(row.get("starts_at"))
    ends = _parse_ts(row.get("ends_at"), end=True)
    if starts is not None and now < starts:
        return False
    if ends is not None and now >= ends:
        return False
    return True


def _read_active_ads() -> list:
    """Synchronous Supabase read.

    Never call this directly -- go through `_active_ads`, which threads it, or
    it stalls every other request for its duration.

    The campaign window is applied here rather than in the SQL so that one
    cached read still serves every slot on the page, and so the rule is
    testable without a live PostgREST. The cache TTL (60s) is the worst case
    for a campaign ending: it may linger for up to a minute past `ends_at`.
    """
    sb = _sb()
    if not sb:
        return []
    rows = sb.table("ads").select("*").eq("is_active", True).execute().data or []
    now = datetime.now(timezone.utc)
    return [r for r in rows if _within_flight(r, now)]


async def _active_ads() -> list:
    """Active ads across all slots, served from memory while the TTL holds."""
    global _ads_cache
    if _ads_cache is not None and _ads_cache[0] > time.time():
        return _ads_cache[1]
    rows = await run_in_threadpool(_read_active_ads)
    _ads_cache = (time.time() + _ADS_TTL, rows)
    return rows


@router.get("/api/ads")
async def get_ads(
    response: Response, slot: str | None = None, session: str | None = None
):
    """Active ads for a slot (or all).

    Returns [] when the system is disabled, when the slot is unknown, or when
    this page load cancelled ads -- so the cancellation is honoured
    server-side too, not only by the button hiding the slot.

    One cached read covers every slot; the filter happens here rather than in
    the query so a page asking for two slots can be served by one round trip
    (the frontend now asks once and splits the result itself).
    """
    sid = _session_id(session)
    if sid and _is_dismissed(sid):
        return []
    if slot and slot not in VALID_SLOTS:
        return []
    started = time.perf_counter()
    rows = await _active_ads()
    # Surfaced so "why are ads slow" is answerable from DevTools' Timing tab
    # rather than by re-measuring from a laptop with a bad connection.
    response.headers["Server-Timing"] = f"ads;dur={(time.perf_counter() - started) * 1000:.1f}"
    if not slot:
        return rows
    return [r for r in rows if r.get("slot") == slot]


@router.post("/api/ads/dismiss")
async def dismiss_ads(body: DismissRequest):
    """Cancel ads for the remainder of this page load.

    Only the page-load token is recorded, and the client never persists it, so
    a reload mints a token this store has never seen and the ads return. The
    TTL below only bounds how long an orphaned record lingers in memory.
    """
    sid = _session_id(body.session)
    if not sid:
        raise HTTPException(status_code=400, detail="A page-load token is required.")
    now = time.time()
    _prune_dismissals(now)
    _dismissed[sid] = now + _DISMISS_TTL
    return {"ok": True, "expires_at": int(_dismissed[sid])}


@router.post("/api/ads/{ad_id}/impression")
async def record_impression(ad_id: str):
    sb = _sb()
    if sb:
        # Threaded: this fires the instant an ad renders, i.e. while the page
        # is still loading, and supabase-py would otherwise block the loop.
        await run_in_threadpool(
            lambda: sb.rpc(
                "increment_ad_counter", {"ad_id": ad_id, "counter": "impressions"}
            ).execute()
        )
    return {"ok": True}


@router.post("/api/ads/{ad_id}/click")
async def record_click(ad_id: str):
    sb = _sb()
    if sb:
        await run_in_threadpool(
            lambda: sb.rpc(
                "increment_ad_counter", {"ad_id": ad_id, "counter": "clicks"}
            ).execute()
        )
    return {"ok": True}


# ---------------------------------------------------------------- admin CRUD

@router.get("/api/admin/ads", dependencies=[Depends(require_admin)])
async def list_ads():
    sb = _require_configured()
    return sb.table("ads").select("*").order("created_at", desc=True).execute().data


@router.post("/api/admin/ads", dependencies=[Depends(require_admin)])
async def create_ad(
    slot: str = Form(...),
    target_url: str = Form(...),
    image_desktop: UploadFile = File(default=None),
    image_mobile: UploadFile = File(default=None),
    starts_at: str | None = Form(default=None),
    ends_at: str | None = Form(default=None),
):
    _require_configured()
    if slot not in VALID_SLOTS:
        raise HTTPException(status_code=400, detail="Invalid slot.")
    starts = _parse_ts(starts_at)
    ends = _parse_ts(ends_at, end=True)
    if starts is not None and ends is not None and ends <= starts:
        raise HTTPException(status_code=400, detail="The end date must be on or after the start date.")

    sb = _require_configured()
    desktop_url = await _upload_if_present(image_desktop, sb)
    mobile_url = await _upload_if_present(image_mobile, sb)
    # Requirement: at least one creative must be uploaded to publish an ad.
    if not desktop_url and not mobile_url:
        raise HTTPException(
            status_code=400,
            detail="Upload at least one image (desktop or mobile) to publish.",
        )

    row = {
        "slot": slot,
        "image_url": desktop_url,
        "image_url_mobile": mobile_url,
        "target_url": target_url,
        "is_active": True,
        "starts_at": starts_at or None,
        "ends_at": ends_at or None,
    }
    res = sb.table("ads").insert(row).execute()
    _invalidate_ads()
    return res.data[0]


async def _upload_if_present(image: UploadFile | None, sb) -> str | None:
    """Upload one creative if supplied, validating type + size. Returns URL or None."""
    if image is None or not image.filename:
        return None
    if image.content_type not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Image must be png, jpg, webp, or gif.")
    content = await image.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 2 MB.")
    ext = (image.filename or "ad.png").rsplit(".", 1)[-1].lower()
    path = f"{uuid.uuid4()}.{ext}"
    sb.storage.from_(ADS_BUCKET).upload(path, content, {"content-type": image.content_type})
    return sb.storage.from_(ADS_BUCKET).get_public_url(path)


@router.patch("/api/admin/ads/{ad_id}", dependencies=[Depends(require_admin)])
async def update_ad(ad_id: str, is_active: bool = Form(...)):
    sb = _require_configured()
    res = sb.table("ads").update({"is_active": is_active}).eq("id", ad_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Ad not found.")
    _invalidate_ads()
    return res.data[0]


@router.delete("/api/admin/ads/{ad_id}", dependencies=[Depends(require_admin)])
async def delete_ad(ad_id: str):
    sb = _require_configured()
    sb.table("ads").delete().eq("id", ad_id).execute()
    _invalidate_ads()
    return {"ok": True}
