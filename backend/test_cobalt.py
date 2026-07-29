"""Unit tests for cobalt_client routing shapes."""

from __future__ import annotations

import json
import os
import socketserver
import threading
from http.server import BaseHTTPRequestHandler

import pytest


def _fresh_module():
    import importlib
    import cobalt_client
    importlib.reload(cobalt_client)
    return cobalt_client


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        response = getattr(self.server, "_tickless_fake_response", {})
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def log_message(self, *a): pass


class FakeCobaltServer:
    def __init__(self, response: dict):
        self.host = "127.0.0.1"
        self.server = socketserver.TCPServer((self.host, 0), _Handler)
        self.server._tickless_fake_response = response
        self.port = self.server.server_address[1]

    def start(self):
        t = threading.Thread(target=self.server.handle_request, daemon=True)
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
