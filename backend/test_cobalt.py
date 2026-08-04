"""Unit tests for cobalt_client routing shapes."""

from __future__ import annotations

import json
import os
import socketserver
import threading
import time
from http.server import BaseHTTPRequestHandler

import pytest


def _fresh_module():
    import importlib

    import cobalt_client
    importlib.reload(cobalt_client)
    return cobalt_client


class _Handler(BaseHTTPRequestHandler):
    def _send_json(self, code, payload):
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def do_GET(self):  # noqa: N802
        # Cold-start simulation: the server can be told to return 503 until
        # a flag flips (i.e. until it "wakes up").
        if getattr(self.server, "_tickless_cold", False):
            self._send_json(503, {"status": "error"})
            return
        self._send_json(200, {"status": "ok"})

    def do_POST(self):  # noqa: N802
        response = getattr(self.server, "_tickless_fake_response", {})
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def log_message(self, *a): pass


class FakeCobaltServer:
    def __init__(self, response: dict, cold: bool = False):
        self.host = "127.0.0.1"
        self.server = socketserver.ThreadingTCPServer((self.host, 0), _Handler)
        self.server._tickless_fake_response = response
        self.server._tickless_cold = cold
        self.port = self.server.server_address[1]

    def start(self):
        t = threading.Thread(target=self.server.serve_forever, daemon=True)
        t.start()
        return t


def test_missing_url_raises_extract_failed():
    mod = _fresh_module()
    with pytest.raises(mod.ExtractionError) as exc:
        mod.cobalt_extract("https://www.instagram.com/reel/ABC/")
    assert exc.value.code == "extract_failed"


def test_tunnel_response_shape():
    mod = _fresh_module()
    response = {
        "status": "tunnel",
        "url": "http://127.0.0.1:19001/dl",
        "filename": "some-video.mp4",
    }
    server = FakeCobaltServer(response)
    t = server.start()
    try:
        os.environ["COBALT_URL"] = f"http://{server.host}:{server.port}"
        mod = _fresh_module()
        d = mod.cobalt_extract("https://www.instagram.com/reel/ABC/")
        assert d["video_url"] == response["url"]
        assert d["title"] == "some video"
    finally:
        t.join(timeout=2)


def test_error_response_maps_code():
    mod = _fresh_module()
    response = {
        "status": "error",
        "error": {"code": "cobalt.service-unsupported"},
    }
    server = FakeCobaltServer(response)
    t = server.start()
    try:
        os.environ["COBALT_URL"] = f"http://{server.host}:{server.port}"
        mod = _fresh_module()
        with pytest.raises(mod.ExtractionError) as exc:
            mod.cobalt_extract("https://www.instagram.com/reel/ABC/")
        # cobalt.service-unsupported maps to Tickless unsupported.
        assert exc.value.code == "unsupported"
    finally:
        t.join(timeout=2)


def test_warmup_polls_until_cobalt_comes_up(monkeypatch):
    """Regression: a cold Cobalt must be polled until it responds, not fail
    on the first 503. Simulate Cobalt waking 0.9s after the first request."""
    mod = _fresh_module()
    monkeypatch.setenv("COBALT_WARMUP_BUDGET", "15")
    monkeypatch.setenv("COBALT_WARMUP_INTERVAL", "0.3")
    mod = _fresh_module()

    response = {"status": "tunnel", "url": "http://127.0.0.1:19002/dl", "filename": "w.mp4"}
    server = FakeCobaltServer(response, cold=True)
    t = server.start()
    # Flip from cold (503) to warm (200) after a short delay, mimicking a
    # Render free-tier wake-up.
    threading.Thread(
        target=lambda: (time.sleep(0.9), setattr(server.server, "_tickless_cold", False)),
        daemon=True,
    ).start()
    try:
        os.environ["COBALT_URL"] = f"http://{server.host}:{server.port}"
        mod = _fresh_module()
        # If warmup did NOT poll, the first 503 would surface as a failure.
        # It must succeed once the server wakes.
        d = mod.cobalt_extract("https://www.instagram.com/reel/ABC/")
        assert d["video_url"] == response["url"]
    finally:
        t.join(timeout=3)


def test_warmup_eventually_gives_up_if_cobalt_never_comes_up(monkeypatch):
    """If Cobalt never wakes, the poll must time out (not hang forever) and
    the normal error path takes over."""
    mod = _fresh_module()
    monkeypatch.setenv("COBALT_WARMUP_BUDGET", "1")
    monkeypatch.setenv("COBALT_WARMUP_INTERVAL", "0.3")
    # Stay cold forever (always 503 -> treated as not-up).
    response = {"status": "error", "error": {"code": "extractor_down"}}
    server = FakeCobaltServer(response, cold=True)
    t = server.start()
    try:
        monkeypatch.setenv("COBALT_URL", f"http://{server.host}:{server.port}")
        mod = _fresh_module()

        start = time.monotonic()
        with pytest.raises(mod.ExtractionError) as exc:
            mod.cobalt_extract("https://www.instagram.com/reel/ABC/")
        elapsed = time.monotonic() - start
        # Must not hang indefinitely; should raise once the budget is spent.
        assert elapsed < 6
        # A 503 from the (still-cold) Cobalt maps to the clean "service
        # temporarily unavailable" message, not a generic extract_failed.
        assert exc.value.code == "extractor_down"
    finally:
        t.join(timeout=3)
