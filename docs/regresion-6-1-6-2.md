# Regresión 6.1–6.2 — SabioDoc

**Fecha:** 19/10/2026  
**Objetivo:** dejar una ejecución repetible antes de producción y una lista manual para el día de la liberación.

## 6.1 Automática

```bash
# Desde la raíz del repo
./scripts/regression.sh

# Incluyendo verificación de producción
VERIFY_PROD=1 ./scripts/regression.sh

# Incluyendo auditoría axe-core
AUDIT_A11Y=1 CHROME_PATH=/snap/bin/chromium ./scripts/regression.sh
```

Cubre:

- `alembic check`;
- `pytest app/tests`;
- lint, TypeScript, Vitest y build;
- opcional: verificación de producción;
- opcional: accesibilidad axe-core.

### Evidencia

Guardar en `docs/evidencias/AAAA-MM-DD/`:

- salida de `regression.sh`;
- `verificacion-produccion.md`;
- `accesibilidad-axe-*.md`;
- capturas de los flujos manuales.

## 6.2 Manual

### Público y cuenta

- [ ] Registro con correo nuevo y verificación.
- [ ] Login, logout y recuperación de contraseña.
- [ ] Cambio de contraseña y cierre de otras sesiones.
- [ ] Postulación médica completa.
- [ ] Perfil de paciente: país, ciudad, teléfono y zona horaria.
- [ ] Consentimientos visibles y revocación.

### Clínico

- [ ] Triage con síntomas de alarma muestra aviso y no recomienda una especialidad insegura.
- [ ] Números de emergencia por país.
- [ ] Guía IA: avanzar, retroceder y conservar respuestas.
- [ ] Resumen de pre-consulta generado para el médico.

### Citas y pagos

- [ ] Reserva con créditos ficticios.
- [ ] Reprogramación y cancelación con reembolso.
- [ ] Detalle de cita muestra retenido, costo final, reembolso, comisión e ingreso médico.
- [ ] No se cobra sin ambos participantes en Jitsi.
- [ ] Cierre de consulta liquida correctamente.

### Videollamada

- [ ] Paciente y médico entran a la misma sala.
- [ ] Ambos ven y oyen al otro.
- [ ] El botón “Iniciar consulta” se bloquea si falta uno.
- [ ] Una desconexión pausa el cronómetro.
- [ ] La sala no queda accesible después de finalizar/expirar.

> Bloqueado hasta tener el Jitsi self-hosted y sus credenciales.

### SEO, seguridad y accesibilidad

- [ ] 404 real en ruta genérica, especialidad y médico inexistentes.
- [ ] Canonical y sitemap con barra final.
- [ ] Cabeceras CSP, Referrer-Policy, Permissions-Policy y framing.
- [ ] Assets inmutables y HTML revalidado.
- [ ] `X-Robots-Tag` en rutas privadas.
- [ ] axe-core sin violaciones en rutas públicas y autenticadas.
- [ ] Prueba de teclado en login, registro, perfil, triage y postulación.

## Criterio de cierre

- Automática en verde.
- Manual obligatoria en verde, salvo la videollamada si Jitsi aún no está desplegado.
- Evidencias guardadas y revisadas.
- Sin datos de prueba publicados: `scripts/validate_seed_data.py`.
