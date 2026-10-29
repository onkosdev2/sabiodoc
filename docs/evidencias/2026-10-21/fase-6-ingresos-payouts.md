# Pagos — Fase 6: ingresos, payouts y conciliación

**Fecha:** 21/10/2026

## Backend

- `DoctorEarning` se crea al finalizar una consulta.
- Nuevo `earnings_service`:
  - resumen pendiente/disponible/pagado;
  - listado de ingresos;
  - solicitud de payout;
  - asignación de ingresos al payout;
  - reintento de payouts fallidos;
  - conciliación interna.
- Endpoints:
  - `GET /earnings/me`
  - `GET /earnings/me/items`
  - `GET /earnings/me/payouts`
  - `POST /earnings/me/payouts`
  - `GET /earnings/admin/payouts`
  - `POST /earnings/admin/payouts/{id}/retry`
  - `GET /earnings/admin/reconciliation`
- Migración `046_doctor_earning_payout.py`:
  - `doctor_earnings.payout_id`.
- El payout usa el proveedor activo. Con mock se marca pagado inmediatamente.
- La conciliación detecta:
  - cargos pagados sin ingreso;
  - montos que no coinciden;
  - cargos sin transacciones aprobadas.

## Frontend

- Nueva ruta `/doctor/earnings`.
- Menú médico muestra “Ingresos y payouts” cuando pagos está activo.
- Tarjetas:
  - pendiente,
  - disponible,
  - pagado.
- Botón “Solicitar payout”.
- Listado de ingresos por cita.
- Listado de payouts con estado y referencia.

## Verificación

```text
Backend: 194 tests OK
Frontend: 38 archivos, 130 tests OK
Alembic check: sin cambios pendientes
Lint: OK
TypeScript: OK
Build: OK
```

Tests nuevos:

- ingresos disponibles tras completar una consulta;
- solicitud de payout y actualización de saldos;
- conciliación admin.

## Estado final

La pasarela de pagos es el único flujo de cobro. El sistema anterior de cobro fue retirado
de la aplicación y de la base de datos.
