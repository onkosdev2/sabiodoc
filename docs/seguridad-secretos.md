# Secretos y CORS — checklist operativo

**Fecha:** 19/10/2026

## Reglas

- Nunca subir `.env` ni claves al repositorio. Solo se versiona `.env.example`.
- Configurar secretos en Render → Environment, no en el frontend.
- El deploy hook del frontend es un secreto: no exponerlo en `VITE_*`.
- Usar claves distintas para staging y producción.
- Stripe: producción solo con `sk_live_`; desarrollo solo con `sk_test_`. La API rechaza la combinación incorrecta al arrancar.

## Rotación

1. Generar el nuevo secreto.
2. Actualizarlo en Render (API o frontend según corresponda).
3. Redesplegar.
4. Verificar login, correo, pagos y videollamada.
5. Revocar el secreto anterior en el proveedor.

| Secreto | Impacto al rotar |
|---|---|
| `JWT_SECRET` | Cierra todas las sesiones activas. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Corta cobros/webhooks hasta actualizar ambos lados. |
| `SMTP_*` | Deja de enviar verificación/recuperación. |
| `CLOUDINARY_*` | Deja de subir/borrar archivos. |
| `JITSI_JWT_SECRET` | Invalida tokens de salas activas. |
| `FRONTEND_DEPLOY_HOOK_URL` | Deja de regenerar el prerender público. |

## CORS

- Producción exige orígenes `https://` y rechaza `*`, `localhost` y `127.0.0.1`.
- La API solo permite los headers `Authorization`, `Content-Type`, `Accept` y `X-Request-ID`.
- Expone `X-Request-ID` para correlacionar errores.
- Si se añade un cliente nuevo, agregar su origen exacto en `FRONTEND_ORIGIN`; nunca usar `*` con credenciales.

## Verificación

```bash
curl -sI https://sabiodoc.onrender.com/specialties \
  -H "Origin: https://sabiodoc-1.onrender.com" | grep -i access-control
```

No debe aparecer un `Access-Control-Allow-Origin` para orígenes no configurados.
