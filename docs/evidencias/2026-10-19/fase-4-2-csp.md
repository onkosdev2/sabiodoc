# Fase 4.2 — CSP en modo bloqueo

**Fecha:** 19/10/2026

## Cambios

- `_headers` pasa de `Content-Security-Policy-Report-Only` a `Content-Security-Policy`.
- Se mantiene `'unsafe-inline'` en `script-src` porque el build inyecta JSON-LD inline por ruta. Si se migra a nonce/hash, se puede retirar.
- Se añaden directivas que faltaban:
  - `worker-src 'self' blob:`
  - `manifest-src 'self'`
  - `frame-ancestors 'none'`
  - `upgrade-insecure-requests`
- `frame-src` incluye `https://meet.jit.si` y `https://*.jitsi.net`.
- El verificador de producción ahora comprueba que la CSP esté en modo bloqueo, no solo Report-Only.
- `render-config.md` incluye el valor exacto para el dashboard de Render.

## Para aplicar en Render

En **Headers**, reemplazar:

```text
Content-Security-Policy-Report-Only
```

por:

```text
Content-Security-Policy
```

con el valor de la sección 4.1 de `render-config.md`.

Si el Jitsi self-hosted usa otro dominio, agregarlo a `script-src`, `frame-src`, `connect-src` y `Permissions-Policy`.

## Verificación

```bash
SITE_URL=https://sabiodoc-1.onrender.com API_URL=https://sabiodoc.onrender.com npm run verify:prod
```

Debe aparecer `header:csp-enforcing` en PASS.

También revisar la consola del navegador en portada, perfil médico, reserva y sala de video.

## Pendiente

- Aplicar el cambio en el dashboard y validar que no haya violaciones de CSP en Jitsi/Cloudinary.
