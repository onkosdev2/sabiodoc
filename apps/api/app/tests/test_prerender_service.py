"""Rebuild del frontend para refrescar el HTML prerenderizado."""

from app.services import prerender_service as module
from app.services.prerender_service import PrerenderService


def test_sin_hook_no_dispara_rebuild():
    service = PrerenderService()
    service.url = None

    assert service.request_rebuild("test", background=False) is False


def test_con_hook_dispara_post_y_no_propaga_errores(monkeypatch):
    calls = []

    class Response:
        status_code = 202

        def raise_for_status(self):
            return None

    def fake_post(url, timeout):
        calls.append((url, timeout))
        return Response()

    monkeypatch.setattr(module.httpx, "post", fake_post)
    service = PrerenderService()
    service.url = "https://api.render.com/deploy/srv-test?key=test"

    assert service.request_rebuild("doctor_approved", background=False) is True
    assert calls == [(service.url, 10.0)]


def test_error_del_hook_no_rompe_la_operacion(monkeypatch):
    def fake_post(url, timeout):
        raise RuntimeError("network down")

    monkeypatch.setattr(module.httpx, "post", fake_post)
    service = PrerenderService()
    service.url = "https://api.render.com/deploy/srv-test?key=test"

    assert service.request_rebuild("doctor_approved", background=False) is False
