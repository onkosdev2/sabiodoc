# Pagos — Fase 2: métodos de pago

**Fecha:** 21/10/2026

## Backend

Endpoints nuevos:

```text
GET    /payments/config
POST   /payments/setup-intent
GET    /payments/methods
POST   /payments/methods
POST   /payments/methods/{id}/default
DELETE /payments/methods/{id}
```

- Cliente de pago por usuario (`PaymentCustomer`).
- Métodos tokenizados (`PaymentMethod`) con marca, últimos 4 y vencimiento.
- Primer método queda predeterminado.
- Al eliminar el predeterminado se elige otro automáticamente.
- Proveedor mock: no se reciben datos reales de tarjeta.
- Endpoints de la pasarela de pagos.

## Frontend

- Nueva ruta `/me/payment-methods`.
- Nuevo enlace “Métodos de pago” en el menú del paciente.
- Lista de tarjetas con:
  - marca y últimos 4,
  - vencimiento,
  - estado predeterminado,
  - acciones para marcar predeterminada y eliminar.
- Alta de tarjeta mock con selector de escenarios.

## Configuración local

```env
PAYMENT_PROVIDER=mock
PAYMENT_CURRENCY=USD
```

La página funciona con la pasarela configurada.

## Verificación

```text
Backend: 181 tests OK
Frontend: 37 archivos, 129 tests OK
Alembic check: sin cambios pendientes
Lint: OK
TypeScript: OK
Build: OK
```

## Siguiente

Fase 3: cotización, reserva sin cobro y confirmación manual del médico.
