# Pagos — Fase 5: ampliaciones y finalización

**Fecha:** 21/10/2026

## Backend

- `POST /video-sessions/{id}/extend`:
  - solo médico;
  - minutos 5, 10 o 15;
  - deja la solicitud pendiente de confirmación del paciente;
  - no cobra todavía.
- `POST /video-sessions/{id}/extend/confirm`:
  - solo paciente;
  - ejecuta el cobro y habilita los minutos;
  - soporta rechazo y 3DS.
- `POST /video-sessions/{id}/extend/reject`:
  - solo paciente;
  - rechaza la solicitud sin generar cobro.
- Al agotarse el tiempo pagado:
  - se pausa el cronómetro;
  - la sesión pasa a `extension_pending`;
  - se abre una gracia de 60 segundos.
- Si el paciente confirma la ampliación:
  - se cobra;
  - se suman minutos;
  - se reanuda el cronómetro solo si ambos siguen en Jitsi.
- Si no amplía o la gracia expira:
  - se finaliza la sesión;
  - se registra `DoctorEarning` con bruto, comisión y neto.
- `confirm-payment` ahora confirma tanto el cobro inicial como una ampliación pendiente de 3DS.

## Frontend

- Banner de tiempo agotado para el médico:
  - selector 5/10/15;
  - importe adicional;
  - “Cobrar y ampliar”;
  - “Finalizar consulta”.
- El paciente ve que el médico está decidiendo.
- Si la ampliación falla:
  - se muestra el motivo;
  - enlace para cambiar tarjeta;
  - se puede reintentar.
- El temporizador se reanuda solo cuando el cobro adicional se confirma.

## Verificación

```text
Backend: 193 tests OK
Frontend: 37 archivos, 129 tests OK
Alembic check: sin cambios pendientes
Lint: OK
TypeScript: OK
Build: OK
```

Tests nuevos:

- ampliación exitosa;
- ampliación rechazada sin agregar tiempo;
- cierre automático al vencer la gracia.

## Niubiz

Se añadió el adaptador `NiubizPaymentProvider` con el mismo contrato que el mock. Sin credenciales, falla con un mensaje claro. Ver `docs/pagos-niubiz.md`.

## Ajuste: cobro fijo durante la sesión

- En sesiones el panel muestra **importe pagado** y **tiempo pagado**, no un
  costo acumulado minuto a minuto.
- El importe inicial cubre el bloque reservado y no se devuelve el tiempo no usado.
- Los ingresos del médico se calculan sobre los cobros confirmados (inicial +
  ampliaciones), no sobre el cronómetro.
- Al agotarse el tiempo pagado la sesión queda en `extension_pending`:
  - no se puede reanudar con `/start`;
  - volver a entrar a Jitsi no reinicia el cronómetro;
  - solo una ampliación cobrada o la finalización resuelven la sesión.
- Si la ampliación requiere 3DS, el estado expone `requires_action` para confirmar
  el pago pendiente antes de habilitar los minutos.
