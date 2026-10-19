# Fase 2.4 — Eventos de Jitsi y presencia

**Fecha:** 19/10/2026  
**Alcance:** capturar eventos reales de la conferencia para presencia y salida.

## Cambios

`apps/web/src/components/JitsiMeeting.tsx` ahora escucha:

- `videoConferenceJoined`: entrada propia.
- `participantJoined`: entrada de otro participante.
- `participantLeft`: salida de otro participante.
- `videoConferenceLeft`: salida de la conferencia.
- `readyToClose`: cierre de la ventana de Jitsi.
- `conferenceFailed`, `connectionFailed`, `errorOccurred`: fallos de conferencia, red o error interno.

Detalles:

- La salida se reporta una sola vez (`leftReported`) aunque lleguen `videoConferenceLeft` y `readyToClose`.
- Los fallos de conferencia/red notifican el error y reportan la salida para que el backend pause presencia y cronómetro.
- `onRemoteParticipantJoined` y `onRemoteParticipantLeft` permiten a la sala refrescar el estado cuando entra o sale el otro participante.

`apps/web/src/pages/VideoConsultationRoom.tsx`:

- Refresca el estado de la sesión al entrar/salir el participante remoto.

## Verificación

- Test de `JitsiMeeting` para eventos de participante remoto, salida y error de conexión.
- Frontend: 29 archivos, 112 tests OK.
- Lint, TypeScript y build: OK.

## Pendiente

- Decidir proveedor (2.1): JaaS/self-hosted con JWT o `meet.jit.si`.
- Validar con dos navegadores reales que la presencia y el cronómetro responden a estos eventos.
