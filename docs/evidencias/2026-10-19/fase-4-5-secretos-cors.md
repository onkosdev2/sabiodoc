# Fase 4.5 — Secretos y CORS

**Fecha:** 19/10/2026

## Cambios

- Producción valida `FRONTEND_ORIGIN`:
  - exige HTTPS;
  - rechaza `*`;
  - rechaza `localhost` y `127.0.0.1`.
- CORS de la API restringido:
  - headers permitidos: `Authorization`, `Content-Type`, `Accept`, `X-Request-ID`;
  - headers expuestos: `X-Request-ID`;
  - preflight cacheado 10 minutos.
- Documento operativo `docs/seguridad-secretos.md` con reglas y rotación de secretos.
- Se mantiene la validación de claves Stripe test/live y el bloqueo de `.env` en git.

## Verificación

```text
Backend: tests de configuración en verde
```

## Pendiente

- Revisar y rotar secretos reales antes de producción.
- Confirmar que staging usa secretos distintos a producción.
