# Fase 2.6 — Salvaguardas de cobro y pago

**Fecha:** 19/10/2026  
**Alcance:** evitar cobros sin presencia y separar claves de pago.

## Cambios

### Cobro solo con presencia

- `POST /video-sessions/{id}/pause` ahora ejecuta `reconcile_timer` antes de pausar.
- `POST /video-sessions/{id}/leave` reconcilia antes de marcar la salida del participante.
- `terminate_for_no_credits` también reconcilia antes de cerrar.
- `reconcile_timer` acumula tiempo solo hasta el último momento en que ambos participantes dieron señales. Si uno dejó de estar presente, no se cobra el tiempo en solitario.

### Claves de pago

- Nueva validación de configuración:
  - producción rechaza `STRIPE_SECRET_KEY` con prefijo `sk_test_`;
  - desarrollo rechaza `sk_live_`.
- Esto evita mezclar cobros reales con pruebas.

### Webhooks

- Se mantiene la validación de firma en `payout_service.verify_webhook`.
- Se mantiene la idempotencia por referencia externa en `wallet_service.handle_payout_event`.
- Tests existentes de webhook inválido e idempotencia siguen en verde.

## Verificación

```text
Backend: 159 tests OK
```

Tests nuevos:

- `reconcile_timer` pausa en el último momento con ambos presentes.
- `reconcile_timer` no hace nada si el cronómetro no está activo.
- producción rechaza clave Stripe de prueba.
- desarrollo rechaza clave Stripe live.

## Pendiente

- Prueba real con el proveedor de pagos en modo test antes de habilitar cobros reales.
- Alertas operativas de cobros anómalos cuando exista monitorización en producción.
