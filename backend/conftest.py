"""Pytest session config for the Tickless backend.

Fixes a test-isolation gotcha: when a real yt-dlp extraction runs (e.g.
test_live_extraction / a TikTok URL), yt-dlp's postprocessor plugin loader
can rebind sys.modules['extractor'] to `ytdlp_plugins.extractor`. After that,
`cobalt_client`'s top-level `from extractor import ExtractionError` breaks with
ImportError. That makes the suite order-dependent (it fails only when a live
extraction runs before a Cobalt test).

To keep the suite deterministic we:
  1. install a meta-path finder that intercepts any import of the bare name
     `extractor` and always returns THIS local module, and
  2. after every test, if yt-dlp swapped sys.modules['extractor'] for its own,
     restore our cached local module (cheap: no re-exec, just a dict write).
"""
import importlib.util
import os
import sys

import pytest


_LOCAL_EXTRACTOR_PATH = os.path.join(os.path.dirname(__file__), "extractor.py")


def _make_local_extractor():
    """Load the local extractor module once and cache it."""
    spec = importlib.util.spec_from_file_location("extractor", _LOCAL_EXTRACTOR_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["extractor"] = module
    spec.loader.exec_module(module)
    return module


class _LocalExtractorFinder:
    """Meta-path finder that forces `import extractor` to resolve locally."""

    def find_spec(self, name, path, target=None):  # noqa: A003
        if name != "extractor":
            return None
        return importlib.util.spec_from_file_location("extractor", _LOCAL_EXTRACTOR_PATH)


# Insert at the front so it wins over any path-based resolution.
sys.meta_path.insert(0, _LocalExtractorFinder())

# Eagerly bind sys.modules['extractor'] to our cached module up front.
_LOCAL_EXTRACTOR = _make_local_extractor()


@pytest.fixture(autouse=True)
def _repin_local_extractor():
    """Undo any yt-dlp runtime poisoning of sys.modules['extractor'].

    Only re-binds if the entry was swapped; reuses the cached module so we do
    not re-execute the (heavy) yt-dlp import on every test.
    """
    yield
    if sys.modules.get("extractor") is not _LOCAL_EXTRACTOR:
        sys.modules["extractor"] = _LOCAL_EXTRACTOR


@pytest.fixture
def client():
    """FastAPI TestClient with no API key required (local-dev style)."""
    from fastapi.testclient import TestClient

    import main as main_mod

    with TestClient(main_mod.app) as c:
        yield c
