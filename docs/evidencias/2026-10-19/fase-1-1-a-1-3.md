# Fase 1.1–1.3 — Seguridad clínica y transcripción

**Fecha:** 19/10/2026  
**Alcance:** números de emergencia, síntomas de alarma y contradicción de transcripción.

## 1.1 Números de emergencia

- Se verificó `apps/web/src/utils/emergencyNumbers.ts`.
- Perú muestra SAMU 106, Bomberos 116, Policía 105, INDECI 115 y orientación 113.
- 911 aparece solo como nota de “central en implementación”, no como número marcable.
- La página muestra `EMERGENCY_LAST_REVIEWED` y la fuente de MINSA.
- Tests añadidos:
  - Perú no incluye `911` en `numbers`.
  - Todos los países tienen etiqueta y teléfono marcable.
  - La fuente de Perú apunta a `gob.pe`.

**Pendiente:** firma de revisión clínica formal.

## 1.2 Síntomas de alarma

Se ampliaron las reglas y los tests para:

- dolor o presión en el pecho,
- dificultad para respirar,
- signos neurológicos/ACV, convulsiones y pérdida de conciencia,
- sangrado abundante y vómito con sangre,
- anafilaxia y edema de garganta/labios,
- intoxicación o sobredosis,
- riesgo suicida,
- embarazo con sangrado.

También se añadió:

- detección de varias banderas en un mismo texto,
- casos normales que no deben disparar la alarma (`dermatología`, `dolor de cabeza`),
- test del componente `AlarmSymptomsBanner`.

**Pendiente:** validación clínica de las reglas y textos.

## 1.3 Transcripción

La transcripción se mantiene como funcionalidad prevista y el copy queda preparado.

- El guion de apertura vuelve a pedir identificar cada voz y mencionar que la sesión puede ser transcrita.
- La sala vuelve a indicar que la introducción ayuda a identificar cada voz en la transcripción.
- Privacidad y Telemedicina describen la transcripción como funcionalidad prevista, con consentimiento específico cuando se implemente.
- La implementación técnica (proveedor, almacenamiento, retención y consentimiento) queda pendiente.

## Verificación ejecutada

```text
Frontend: 29 archivos, 111 tests OK
Backend:  156 tests OK
Lint:     OK
TypeScript: OK
Build:    OK
```
