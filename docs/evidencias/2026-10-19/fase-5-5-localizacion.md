# Fase 5.5 — Localización, ubicación y zona horaria

**Fecha:** 19/10/2026

## Cambios

- Nueva lista de zonas horarias con Perú primero:
  - `America/Lima`, luego Colombia, México, Argentina, Chile, Ecuador, Brasil, España y EE. UU.
- Etiquetas legibles:
  - `Lima (UTC−5)`, `Bogotá (UTC−5)`, `Ciudad de México (UTC−6)`.
  - Se reemplaza `GMT` por `UTC` y el guion por el signo menos tipográfico.
- Nombres de ciudades conocidas corregidos: Ciudad de México, Bogotá, São Paulo, Nueva York, Los Ángeles, Panamá.
- Países priorizados en los selectores: Perú, Colombia, México, Chile, Argentina, Ecuador, Bolivia, Paraguay, Uruguay, Venezuela, España, EE. UU. y Brasil; el resto por nombre en español.
- `PatientProfile`, `DoctorOnboarding` y `PatientProfileEditModal` usan la lista priorizada de zonas horarias.
- `DoctorAvailability` y `DoctorPending` muestran la zona con etiqueta legible, no el identificador IANA crudo.
- Teléfonos:
  - se elimina cualquier `+` inicial duplicado al construir el número;
  - el parser tolera valores guardados con `++`.
- Tests añadidos:
  - `timeZoneLabel` usa UTC y nombres legibles;
  - `getTimeZoneOptions` prioriza Perú y no duplica;
  - `sortCountries` prioriza Perú y la operación.

## Buscador de país

- Nuevo `CountrySelect` con input + datalist.
- Permite buscar por nombre localizado o código ISO (`Perú`, `PE`, `Colombia`, `CO`).
- Mantiene el valor interno como ISO.
- Usado en el perfil del paciente y en la postulación médica.
- Tests para búsqueda por nombre y por código.

## Pendiente

- Los nombres de ciudades vienen del dataset de `country-state-city`; no se traducen de forma masiva. El campo permite escribir o elegir con datalist.

## Verificación

```text
Frontend: 33 archivos, 121 tests OK
Lint:     OK
TypeScript: OK
Build:    OK
```
