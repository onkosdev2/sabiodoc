# Fase 1.5 — Documentos legales versionados

**Fecha:** 19/10/2026

## Cambios

- Nuevo `utils/legal.ts` con:
  - versión `1.0`;
  - fecha `19 de octubre de 2026`;
  - estado editorial `pending_legal_review`.
- `LegalPage` ya no muestra “Borrador provisional”.
  - Muestra “Versión 1.0 · Pendiente de revisión legal” mientras no haya aprobación formal.
  - Si se cambia `LEGAL_STATUS` a `approved`, muestra “Versión 1.0 · Aprobada”.
- Privacidad, Términos y Telemedicina usan la misma versión y fecha.
- Privacidad:
  - el responsable se contacta por Ayuda y soporte;
  - Jitsi se describe como self-hosted previsto;
  - se mantienen encargados, conservación, derechos y transferencias.
- Telemedicina actualizada al Jitsi self-hosted previsto.
- Enlaces legales añadidos en:
  - registro;
  - reserva;
  - Triage;
  - sala de videoconsulta;
  - pie de página.
- El registro exige aceptar términos y privacidad y registra ambos consentimientos.
- Migración `042_consent_fk_cascade.py` para que borrar usuario/cita elimine sus consentimientos.

## Verificación

```text
Backend: 168 tests OK
Frontend: 34 archivos, 123 tests OK
Alembic check: sin cambios pendientes
Lint: OK
TypeScript: OK
Build: OK
```

## Pendiente

- Aprobación formal por asesoría legal; luego cambiar `LEGAL_STATUS` a `approved`.
- Revisión específica de menores, DPA/encargados y transferencias internacionales.
- Completar textos de conservación/eliminación por tipo de dato si legal lo requiere.
