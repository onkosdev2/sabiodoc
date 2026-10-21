# Fase 5.3 — Auditoría WCAG 2.2 AA

**Fecha:** 19/10/2026

## Herramienta

- `axe-core` sobre Chromium mediante `puppeteer-core`.
- Reglas: WCAG 2.0/2.1/2.2 A y AA.
- Script: `apps/web/scripts/audit-a11y.mjs`.
- Comandos:

```bash
cd apps/web
CHROME_PATH=/snap/bin/chromium npm run audit:a11y
CHROME_PATH=/snap/bin/chromium npm run audit:a11y:mobile
```

## Rutas auditadas

- `/`
- `/como-funciona/`
- `/specialties/`
- `/specialties/cardiologia/`
- `/doctors/2/`
- `/triage/`
- `/guide/`
- `/emergency/`
- `/privacidad/`
- `/terminos/`
- `/telemedicina/`
- `/login/`
- `/register/`
- `/forgot-password/`
- `/doctor/apply/`

## Resultado

```text
Desktop 1440×900: 0 violaciones
Mobile 390×844:   0 violaciones
Violaciones serias/críticas: 0
```

Evidencia:

- `docs/evidencias/2026-10-21/accesibilidad-axe-desktop.md`
- `docs/evidencias/2026-10-21/accesibilidad-axe-mobile.md`

## Pendiente

- Auditar rutas autenticadas de paciente, médico y admin con sesiones de prueba.
- Repetir la auditoría después de cambios visuales importantes.

## Auditoría autenticada

Se ejecutó la misma herramienta con sesiones demo locales:

| Sesión | Rutas auditadas | Resultado |
|---|---|---|
| Paciente | `/me/profile`, `/me/appointments`, `/me/wallet`, `/notifications` | 0 violaciones |
| Médico | `/doctor`, citas, perfil, disponibilidad, videosesiones, billetera | 0 violaciones |
| Admin | overview, usuarios, finanzas, sistema, errores | 0 violaciones |
| Revisor | postulaciones médicas | 0 violaciones |
| Soporte | tickets | 0 violaciones |

### Correcciones aplicadas

- `UserMenu`: `aria-label` ahora incluye el texto visible “Perfil”.
- `PanelLayout`: texto “SabioDoc” con `text-slate-400` sobre fondo oscuro.
- `Pagination`: texto de rango con `text-slate-600`.
- `AdminErrors`:
  - se eliminó `role="button"` de las filas con checkbox dentro;
  - se añadió botón “Ver detalle”;
  - checkboxes de 24×24 px;
  - textos `text-slate-400/500` cambiados a `text-slate-600`.
- `AdminSystemHealth`: “Última consulta” con `text-slate-600`.
- `DoctorApplicationReview` y `SupportTicketThread`/`SupportInbox`: textos con contraste corregido.

Evidencia autenticada:

- `accesibilidad-axe-paciente-desktop.md`
- `accesibilidad-axe-medico-desktop.md`
- `accesibilidad-axe-admin-desktop.md`
- `accesibilidad-axe-revisor-desktop.md`
- `accesibilidad-axe-soporte-desktop.md`
