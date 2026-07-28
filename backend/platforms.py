"""Platform registry: single source of truth for supported platforms.

Adding a new platform = add one entry here plus a frontend landing page.
Nothing else should hard-code platform names or hostnames.
"""

PLATFORMS: dict[str, dict] = {
    "tiktok": {
        "display": "TikTok",
        "hosts": {
            "tiktok.com",
            "www.tiktok.com",
            "m.tiktok.com",
            "vm.tiktok.com",
            "vt.tiktok.com",
            "v.douyin.com",
        },
        # Fallback noun used in download filenames when title is empty.
        "noun": "tiktok",
    },
    "instagram": {
        "display": "Instagram",
        "hosts": {
            "instagram.com",
            "www.instagram.com",
            "m.instagram.com",
            "instagr.am",
            "www.instagr.am",
        },
        "noun": "instagram",
    },
}


def detect_platform(host: str) -> str | None:
    """Map a hostname to a platform key, or None if unsupported."""
    host = (host or "").lower().split(":")[0]
    for key, cfg in PLATFORMS.items():
        if host in cfg["hosts"]:
            return key
    return None


def display_name(platform: str) -> str:
    return PLATFORMS.get(platform, {}).get("display", platform)
