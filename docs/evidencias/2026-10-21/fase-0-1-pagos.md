# Pagos — Fase 0 y 1

**Fecha:** 21/10/2026

## Fase 0 — Mock y contratos

- Interfaz `PaymentProvider` con:
  - cliente,
  - setup intent,
  - métodos de pago,
  - cobro,
  - confirmación 3DS,
  - reembolso,
  - payout,
  - verificación de webhook.
- Adaptador `MockPaymentProvider` en memoria.
- Tokens de prueba:
  - `pm_mock_success`
  - `pm_mock_declined`
  - `pm_mock_insufficient`
  - `pm_mock_3ds`
  - `pm_mock_timeout`
  - `pm_mock_expired`
- Webhooks firmados con HMAC SHA-256 (`X-Mock-Signature`).
- Configuración:
  - 
  - `PAYMENT_PROVIDER=mock`
  - `PAYMENT_CURRENCY=USD`
  - `MOCK_PAYMENT_WEBHOOK_SECRET`
  - `MOCK_PAYMENT_LATENCY_MS`

## Fase 1 — Modelo de datos

Migración `043_payments.py`:

- `payment_customers`
- `payment_methods`
- `payment_transactions`
- `consultation_charges`
- `doctor_earnings`
- `payouts`

Incluye enums de estado, índices, claves únicas e idempotencia.

## Verificación

```text
Backend: 177 tests OK
Alembic check: sin cambios pendientes
```

Tests nuevos del proveedor mock:

- cliente y setup intent;
- alta/baja de métodos;
- pago exitoso idempotente;
- rechazo y fondos insuficientes;
- 3DS + confirmación;
- reembolso total y parcial;
- payout idempotente;
- webhook con firma válida e inválida.

## Pendiente

- Fase 2: endpoints y UI de métodos de pago.
- Fase 3: cotización, reserva y confirmación del médico.
- Fase 4: cobro inicial y gate de Jitsi.
