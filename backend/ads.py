"""Ad system: public ad serving + admin CRUD, backed by Supabase.

Gracefully disabled when SUPABASE_URL is not configured:
  - GET /api/ads returns [] (frontend renders nothing)
  - admin routes return 503

Visitors can also cancel ads for the current browser session. That state is
deliberately ephemeral and process-local -- see the session-cancel section.
"""
import os
import time
import uuid

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Form, HTTPException, Header, UploadFile
from pydantic import BaseModel

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


# ------------------------------------------- session-scoped cancellation

# Cancellation is deliberately ephemeral. The client mints a random id and keeps
# it in sessionStorage, so closing the tab mints a fresh id and the ads return on
# the next visit -- which is exactly the product rule ("you just have to cancel
# on every visit"). Nothing here is permanent, and nothing here is tied to IP or
# to a login, because both would leak the cancellation into later visits.
#
# Held in process memory rather than Supabase: this is session state, not
# catalogue data, so it should evaporate on restart and must never accumulate
# rows. Render's free tier is single-instance, so a dict is the right store here.

_DISMISS_TTL = 12 * 60 * 60  # seconds; far longer than any realistic tab lifetime
_DISMISS_MAX = 10_000        # hard cap so an unauthenticated flood cannot grow memory
_dismissed: dict[str, float] = {}  # session id -> expiry (epoch seconds)


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
    """Normalise a client-supplied session id; None when there is no usable one."""
    if not raw:
        return None
    sid = raw.strip()[:64]
    return sid or None


def _is_dismissed(session: str) -> bool:
    """True while the session's cancellation is still live."""
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

@router.get("/api/ads")
async def get_ads(slot: str | None = None, session: str | None = None):
    """Active ads for a slot (or all).

    Returns [] when the system is disabled, when the slot is unknown, or when
    this visitor cancelled ads for the current session -- so the cancellation
    is honoured server-side too, not only by the button hiding the slot.
    """
    sid = _session_id(session)
    if sid and _is_dismissed(sid):
        return []
    sb = _sb()
    if not sb:
        return []
    q = sb.table("ads").select("*").eq("is_active", True)
    if slot:
        if slot not in VALID_SLOTS:
            return []
        q = q.eq("slot", slot)
    rows = q.execute().data or []
    return rows


@router.post("/api/ads/dismiss")
async def dismiss_ads(body: DismissRequest):
    """Cancel ads for the remainder of this browser session.

    Only the session id is recorded, so the cancellation dies with the tab that
    asked for it; a later visit mints a new id and sees ads again.
    """
    sid = _session_id(body.session)
    if not sid:
        raise HTTPException(status_code=400, detail="A session id is required.")
    now = time.time()
    _prune_dismissals(now)
    _dismissed[sid] = now + _DISMISS_TTL
    return {"ok": True, "expires_at": int(_dismissed[sid])}


@router.post("/api/ads/{ad_id}/impression")
async def record_impression(ad_id: str):
    sb = _sb()
    if sb:
        sb.rpc("increment_ad_counter", {"ad_id": ad_id, "counter": "impressions"}).execute()
    return {"ok": True}


@router.post("/api/ads/{ad_id}/click")
async def record_click(ad_id: str):
    sb = _sb()
    if sb:
        sb.rpc("increment_ad_counter", {"ad_id": ad_id, "counter": "clicks"}).execute()
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
    return res.data[0]


@router.delete("/api/admin/ads/{ad_id}", dependencies=[Depends(require_admin)])
async def delete_ad(ad_id: str):
    sb = _require_configured()
    sb.table("ads").delete().eq("id", ad_id).execute()
    return {"ok": True}
