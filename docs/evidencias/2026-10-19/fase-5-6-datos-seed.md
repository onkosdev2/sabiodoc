# Fase 5.6 — Validación de datos seed

**Fecha:** 19/10/2026

## Cambios

- Nuevos campos en `doctor_profiles`:
  - `is_published` (por defecto `true`): permite despublicar un perfil sin borrar su historial.
  - `is_seed` (por defecto `false`): marca perfiles creados por el seed.
- Migración `040_doctor_publication_flags.py`.
- El seed:
  - marca `is_seed=true`;
  - en producción deja `is_published=false`;
  - se omite por completo en producción salvo `ALLOW_SEED_IN_PRODUCTION=true`.
- Las consultas públicas filtran `is_published=true`:
  - listado por especialidad,
  - detalle del médico,
  - favoritos,
  - validación de reserva.
- Nuevo `seed_guard.py`:
  - detecta por `is_seed`, nombre (`Test`, `Demo`, `QA`, `Example`) y correo (`*.demo@`, `qa@example.com`, etc.).
- Nuevo script `apps/api/scripts/validate_seed_data.py`:
  - lista médicos de prueba publicados;
  - devuelve código 1 si encuentra alguno.
- Tests:
  - detección por marca, nombre y correo;
  - no marca médicos reales.

## Verificación

```text
Backend: 166 tests OK
Alembic check: sin cambios pendientes
```

## Pendiente

- Ejecutar `validate_seed_data.py` contra la base de producción antes del lanzamiento real.
- Opcional: botón de publicar/despublicar en el panel admin.
