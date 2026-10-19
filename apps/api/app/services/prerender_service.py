"""Rebuild del frontend para refrescar el HTML prerenderizado.

Las páginas públicas (especialidades y médicos) se generan en el build. Cuando
un médico se aprueba, cambia su perfil o su foto, hay que regenerar ese HTML.
Si `FRONTEND_DEPLOY_HOOK_URL` está configurado, se dispara el deploy hook de
Render en segundo plano; si no, la operación sigue sin bloquearse.
"""

import threading

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class PrerenderService:
    def __init__(self) -> None:
        self.url = settings.FRONTEND_DEPLOY_HOOK_URL

    def request_rebuild(self, reason: str, *, background: bool = True) -> bool:
        """Solicita un rebuild. Devuelve False si no hay hook configurado."""
        if not self.url:
            logger.info(f"Prerender rebuild omitido ({reason}): FRONTEND_DEPLOY_HOOK_URL no configurado")
            return False

        if background:
            threading.Thread(target=self._post, args=(reason,), daemon=True).start()
            return True

        return self._post(reason)

    def _post(self, reason: str) -> bool:
        try:
            response = httpx.post(self.url, timeout=10.0)
            response.raise_for_status()
            logger.info(f"Prerender rebuild solicitado: {reason} (HTTP {response.status_code})")
            return True
        except Exception as error:  # best-effort: no debe romper la operación
            logger.warning(f"No se pudo solicitar el prerender rebuild ({reason}): {error}")
            return False


prerender_service = PrerenderService()
