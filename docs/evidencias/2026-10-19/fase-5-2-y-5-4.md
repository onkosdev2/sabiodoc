# Fase 5.2 y 5.4 — Errores de formulario y estados de carga

**Fecha:** 19/10/2026

## 5.2 Errores de formulario

- Nuevo componente `ErrorSummary`: cuando hay dos o más errores, muestra un resumen con `role="alert"`.
- Integrado en Login, Registro y postulación médica.
- El foco sigue moviéndose al primer campo inválido con `focusFirstInvalid`.
- Se añadió `aria-describedby` al campo de nombre de la postulación médica para enlazar su mensaje de error.
- Tests añadidos:
  - Login: foco en correo y resumen visible con dos errores.
  - Triage: foco en el campo de síntomas.
  - `ErrorSummary`: no aparece con 0–1 errores y lista todos con varios.

## 5.4 Estados de carga

- `Specialties` ahora distingue entre debounce y carga real:
  - durante el debounce muestra “Buscando…” y skeleton;
  - no muestra “Resultados (0)” antes de terminar;
  - conserva resultados anteriores si ya existían.
- El spinner del buscador aparece también durante el debounce.
- La guía IA ya tenía skeleton y estado “Pensando…”, sin cambios.
- Test añadido: durante la búsqueda no aparece “Resultados (0)” y luego se muestra “Sin resultados” al resolver.

## Verificación

```text
Frontend: 31 archivos, 116 tests OK
Lint:     OK
TypeScript: OK
Build:    OK
```

## Pendiente

- Prueba manual con teclado y lector de pantalla en perfil, triage y postulación médica.
