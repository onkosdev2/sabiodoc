# Fase 2.5 — Máquina de estados y mensajes

**Fecha:** 19/10/2026  
**Alcance:** unificar presencia, estado, botón de inicio y mensaje del cronómetro.

## Cambios

`apps/web/src/pages/VideoConsultationRoom.tsx`:

- Se separó la presencia de la app de la presencia real en Jitsi.
- Cuando la sala es real (`jitsi_required`), la fuente de verdad para:
  - el estado de la sala,
  - la fila “Tú” y “Paciente/Médico”,
  - el mensaje del cronómetro,
  - el botón “Iniciar consulta”,
  es la presencia en Jitsi.
- Se eliminó la combinación contradictoria:
  - “Ambos conectados” en el estado, junto con
  - “Nadie ha entrado” en la videollamada.
- El mensaje del cronómetro ahora distingue:
  - ambos dentro de la videollamada,
  - falta que ambos entren a la videollamada,
  - falta el paciente/médico en la sala.
- Se usan las horas de entrada a Jitsi (`jitsi_*_joined_at`) para mostrar cuándo entró cada participante.

## Verificación

```text
Frontend: 29 archivos, 112 tests OK
Lint:     OK
TypeScript: OK
Build:    OK
```

## Pendiente

- Validar visualmente con dos navegadores cuando el Jitsi self-hosted esté disponible.
