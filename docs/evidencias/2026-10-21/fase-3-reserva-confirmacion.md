# Pagos — Fase 3: cotización, reserva y confirmación

**Fecha:** 21/10/2026

## Backend

- `POST /appointments/quote`:
  - calcula importe por duración;
  - devuelve moneda, comisión e ingreso médico.
- Reserva (`PAYMENT_PROVIDER=mock`):
  - exige método de pago activo;
  - crea la cita como `confirmation_status=pending`;
  - no cobra en la reserva;
  - crea `ConsultationCharge` en estado `pending`;
  - expira la solicitud en 12 horas.
- Confirmación del médico:
  - `POST /appointments/{id}/confirm`;
  - solo el médico de la cita;
  - pasa a `confirmed`.
- Rechazo:
  - `POST /appointments/{id}/decline`;
  - cancela la cita y libera el horario;
  - marca el cargo como `cancelled`.
- Expiración automática:
  - al listar citas o consultar una cita se cancelan las solicitudes vencidas.
- Reprogramación:
  - actualiza importe y vuelve a pedir confirmación.
- Sala:
  - no se puede preparar una cita sin confirmación;
  - el cobro inicial se realiza al iniciar la consulta.

## Frontend

- Reserva:
  - exige tarjeta antes de confirmar;
  - muestra tarjeta predeterminada o enlace para agregar una;
  - informa que la cita queda pendiente de confirmación.
- Paciente:
  - badge “Pendiente de confirmación”;
  - oculta el acceso a la sala hasta que el médico confirme.
- Médico:
  - badge de solicitud pendiente;
  - botones Confirmar y Rechazar;
  - motivo obligatorio al rechazar.

## Verificación

```text
Backend: 185 tests OK
Frontend: 37 archivos, 129 tests OK
Alembic check: sin cambios pendientes
Lint: OK
TypeScript: OK
Build: OK
```

## Siguiente

Fase 4: cobro inicial al confirmar el inicio, gate de Jitsi y temporizador server-side.
