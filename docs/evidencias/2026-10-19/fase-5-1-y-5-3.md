# Fase 5.1 y 5.3 — Cabecera móvil, contraste y estados accesibles

**Fecha:** 19/10/2026

## 5.1 Cabecera móvil

- Logo más compacto en móvil (`text-xl` / icono `h-7`), mantiene tamaño en `sm`.
- En móvil, los enlaces públicos se agrupan en un menú compacto:
  - ¿Cómo funciona?
  - Soy médico
  - Iniciar sesión
  - Registrarse
- El botón del menú tiene `aria-expanded`, `aria-controls`, `aria-label` y cierre con Escape/click fuera.
- En escritorio (`md+`) se mantiene la navegación horizontal.
- Objetivos táctiles:
  - botón de menú: mínimo 44×44 px;
  - enlaces del menú móvil: mínimo 44 px de alto;
  - botón de usuario: mínimo 44 px;
  - campana de notificaciones: `p-2.5`;
  - enlaces legales del pie: mínimo 44 px.
- El dropdown de usuario limita su ancho a `calc(100vw - 2rem)` para no desbordar en 320 px.
- Test añadido para abrir/cerrar el menú móvil y comprobar sus enlaces.

## 5.3 Contraste y estados accesibles

- Los horarios de `DoctorDetail` ya exponen `aria-pressed`.
- Los filtros y tabs principales usan `aria-pressed`/`aria-selected`.
- Los pares de color revisados usan variantes más oscuras:
  - CTA verde: `bg-emerald-700` con texto blanco.
  - Aviso del pie: `bg-amber-50` con `text-amber-800`.
  - Subtítulo de emergencia: `text-red-700` sobre `bg-red-50`.
- Pendiente: pasar una herramienta automatizada WCAG 2.2 AA para confirmar contraste en todas las plantillas.

## Verificación

```text
Frontend: 32 archivos, 117 tests OK
Lint:     OK
TypeScript: OK
Build:    OK
```
