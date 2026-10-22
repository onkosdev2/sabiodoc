# Manejo de cámara, micrófono y desconexiones

**Fecha:** 19/10/2026

## Cambios

- `getUserMedia` con límite de **12 segundos**.
- Si el stream llega después del timeout, se detienen sus pistas.
- Clasificación de errores:
  - permiso denegado;
  - dispositivo no encontrado;
  - dispositivo ocupado por otra aplicación;
  - restricción de dispositivo no satisfecha;
  - timeout;
  - error genérico.
- Mensaje accionable por cada caso, anunciado con `role="status"` y `aria-live="polite"`.
- Lista de cámaras y micrófonos con `enumerateDevices` después de obtener permiso.
- Selector de cámara y micrófono; el reintento usa el dispositivo elegido.
- Las pistas de la prueba se detienen siempre al terminar.
- El botón queda disponible para reintentar después de cualquier fallo.
- Se aclara que comprobar dispositivos no genera cobro y que se puede salir sin cobro.
- Tests de clasificación de errores.

## Verificación

```text
Frontend: 36 archivos, 126 tests OK
Lint: OK
TypeScript: OK
Build: OK
```

## Pendiente

- Prueba manual en Chrome/Brave/Firefox con permisos denegados, cámara ocupada y timeout.
- Decidir con producto si `conferenceFailed` debe marcar la sesión como `failed` o `interrupted`; hoy se reporta la salida y se pausa presencia.
