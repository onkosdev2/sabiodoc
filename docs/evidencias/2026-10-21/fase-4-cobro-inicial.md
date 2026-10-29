# Pagos — Fase 4: cobro inicial, gate de Jitsi y temporizador

**Fecha:** 21/10/2026

## Backend

- `POST /video-sessions/{id}/start`:
  - exige que paciente y médico estén en la sala de la app;
  - solicita el cobro inicial al proveedor;
  - no inicia el cronómetro si el pago falla;
  - devuelve `payment_state` y datos del fallo.
- `POST /video-sessions/{id}/confirm-payment`:
  - confirma pagos que requieren 3DS;
  - solo el médico.
- `charge_service`:
  - crea `PaymentTransaction` idempotente;
  - usa el método de pago guardado;
  - permite reintentar con otro método;
  - actualiza `ConsultationCharge`, `VideoSession.payment_status` y `payment_amount_cents`.
- El cronómetro se inicia automáticamente cuando:
  - el pago está capturado;
  - ambos participantes están dentro de Jitsi.
- 

## Frontend

- Jitsi no se monta hasta que `payment_state === 'paid'`.
- Lobby con estado de pago:
  - pendiente,
  - requiere 3DS,
  - rechazado,
  - pagado.
- Botón “Completar pago” para 3DS.
- En rechazo:
  - se muestra el mensaje del proveedor;
  - enlace para cambiar tarjeta;
  - el médico puede reintentar el cobro.
- El paciente ve “Pago pendiente” hasta que el médico autoriza y se cobra.
- El importe cotizado no se muestra como pagado antes de confirmarse el cobro.

## Verificación

```text
Backend: 188 tests OK
Frontend: 37 archivos, 129 tests OK
Lint: OK
TypeScript: OK
Build: OK
```

Tests nuevos:

- cobro exitoso y timer al entrar ambos a Jitsi;
- pago rechazado sin conferencia ni timer;
- 3DS + confirmación + pago.

## Siguiente

Fase 5: ampliaciones de tiempo con cobro adicional, gracia de 60 segundos y finalización.

## Ajuste: Jitsi antes del cobro

- La conferencia se abre cuando ambos entran a la sala, antes del pago.
- El médico pulsa “Iniciar consulta” cuando ambos están dentro de Jitsi.
- Ese clic ejecuta el cobro inicial.
- Si el pago se confirma, arranca el cronómetro server-side.
- Si el pago falla, la conferencia sigue abierta, el cronómetro no inicia y se puede reintentar o cambiar tarjeta.
- El endpoint `/start` exige presencia real de ambos en Jitsi.
- El temporizador se inicia inmediatamente después del cobro si ambos ya están en Jitsi.

## Mock tras reinicios

- Los IDs de método mock ahora incluyen el escenario (`mock_pm_success_...`).
- Si el proceso se reinicia, el proveedor mock rehidrata el método y el cobro no falla con “Método de pago mock no válido”.
- Los métodos antiguos `mock_pm_...` se tratan como escenario `success` para no romper pruebas previas.

## Ajuste: sin moderador obligatorio

- Nuevo flag `JITSI_MODERATOR_REQUIRED=false`.
- Ningún participante recibe moderación por defecto.
- `JitsiMeeting` configura `membersOnly=false`, `enableLobby=false`, `startAsVisitor=false` y oculta el indicador de moderador.
- Documentación para Jitsi self-hosted en `docs/jitsi-self-hosted.md`.
- `meet.jit.si` no permite desactivar su requisito de moderador desde el cliente; para producción se usará el Jitsi propio.

## Host de Jitsi

- `JITSI_MODERATOR_REQUIRED=false` no desactiva el requisito de moderador de `meet.jit.si`.
- `https://meet.ffmuc.net` permite entrar directo sin moderador, pero no se puede incrustar: envía `X-Frame-Options: SAMEORIGIN` y `frame-ancestors` limitado. No sirve como reemplazo dentro de SabioDoc.
- Al cambiar `JITSI_BASE_URL`, las salas preparadas con el host anterior se expiran y se genera una sala nueva.
