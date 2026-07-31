"""Ad system: public ad serving + admin CRUD, backed by Supabase.

Gracefully disabled when SUPABASE_URL is not configured:
  - GET /api/ads returns [] (frontend renders nothing)
  - admin routes return 503
"""
import os
import time
import uuid

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Form, HTTPException, Header, UploadFile

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
async def get_ads(slot: str | None = None):
    """Active ads for a slot (or all). Returns [] when system disabled."""
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
