# Fase 1.4 — Consentimientos separados y versionados

**Fecha:** 19/10/2026

## Backend

- Nuevo modelo `Consent` con:
  - usuario,
  - cita opcional,
  - tipo de consentimiento,
  - versión,
  - fecha de aceptación,
  - fecha de revocación,
  - IP y user-agent.
- Tipos separados:
  - `terms`
  - `privacy`
  - `clinical_data`
  - `telemedicine`
  - `transcription`
  - `recording`
  - `marketing`
- Migración `041_consents.py`.
- `consent_service`:
  - registra una aceptación;
  - reutiliza la aceptación activa si la versión es la misma;
  - revoca la versión anterior cuando cambia;
  - permite revocar por tipo/cita;
  - registra automáticamente términos, privacidad, telemedicina y datos clínicos al crear una cita.
- Endpoints:
  - `GET /consents/me`
  - `POST /consents/revoke`
- La creación de cita exige:
  - `accepted_terms` (términos y privacidad);
  - `accepted_data_terms` (videoconsulta y datos clínicos);
  - `accepted_overtime_terms`.

## Frontend

- La reserva ahora tiene dos consentimientos separados:
  - términos y política de privacidad;
  - consentimiento de videoconsulta y datos clínicos.
- El consentimiento de horas extra se mantiene aparte.
- El botón de confirmar exige los tres.
- Triage muestra un aviso contextual antes de enviar síntomas, con enlaces a privacidad y telemedicina.

## Verificación

```text
Backend: 168 tests OK
Frontend: 33 archivos, 121 tests OK
Alembic check: sin cambios pendientes
Lint: OK
TypeScript: OK
Build: OK
```

## Segunda parte

- Triage:
  - exige aceptar el tratamiento de datos clínicos antes de enviar;
  - el backend registra `privacy` y `clinical_data` para usuarios autenticados.
- Seguridad:
  - nueva sección “Consentimientos” con lista de aceptaciones activas;
  - muestra tipo, versión, fecha y cita;
  - permite revocar con confirmación.
- Tests de consentimientos: registro, versionado, revocación y consentimientos obligatorios de una cita.

## Tercera parte

- La postulación médica exige aceptar términos y política de privacidad.
- El backend registra `terms` y `privacy` con la versión indicada.
- El payload de perfil médico incluye `accepted_terms` y `consent_text_version`.

## Pendiente

- Textos legales definitivos y versionado editorial (1.5).
