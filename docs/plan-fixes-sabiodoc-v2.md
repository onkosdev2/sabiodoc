# Plan de fixes SabioDoc v2

**Base:** `docs/plan-correccion-sabiodoc.docx` + auditoría del 13/10/2026 + verificación del repositorio y de `https://sabiodoc-1.onrender.com/` del 19/10/2026.

**Objetivo:** cerrar los riesgos reales que impiden aprobar producción, sin reimplementar lo que ya existe y sin confundir “código listo” con “desplegado y verificado”.

**Regla de liberación:** no se habilitan cobros reales hasta que dos usuarios completen audio y video en la misma sala, el cobro dependa de esa presencia y las condiciones clínicas, legales y de seguridad estén verificadas en producción.

## Estado de ejecución

- **0.1 Configurar Render:** completado. Redirects, 404, cabeceras, caché y MIME del manifest aplicados. Ver `docs/evidencias/2026-10-19/render-config.md`.
- **0.2 Verificación de producción:** completado el 19/10/2026. Resultado final: 65/66 comprobaciones OK, 0 fallos críticos y 1 advertencia (`Dr. Test`, aceptado temporalmente). Evidencia en `docs/evidencias/2026-10-19/`. Antes de producción real, `npm run verify:prod -- --strict` debe pasar sin advertencias.
- **0.3 Retirar datos de prueba:** aplazado por decisión del usuario. Se hará manualmente al terminar el testeo y antes de pasar a producción real. No es un bloqueo para seguir probando, pero sí para cobros reales.
- **1.1 Emergencias:** números de Perú verificados en código, con fecha, fuente y tests. Pendiente la firma de revisión clínica formal.
- **1.2 Síntomas de alarma:** reglas ampliadas y tests para dolor torácico, disnea, ACV, convulsiones, sangrado, anafilaxia, intoxicación, riesgo suicida y embarazo. Pendiente validación clínica.
- **1.3 Transcripción:** copy restaurado y preparado. El guion, la sala y las políticas vuelven a describir la transcripción como funcionalidad prevista. Falta la implementación técnica (proveedor, consentimiento, retención).
- **2.1 Proveedor:** decidido Jitsi self-hosted para poder ofrecer transcripción. Queda pendiente de provisión y credenciales; no bloquea el resto del código.
- **2.4 Eventos Jitsi:** completado. `JitsiMeeting` escucha `participantJoined`, `participantLeft`, `videoConferenceLeft`, `conferenceFailed`, `connectionFailed` y `errorOccurred`; la sala refresca el estado al entrar/salir el participante remoto.
- **2.5 Estados y mensajes:** completado. La presencia, el estado, el botón y el mensaje del cronómetro usan la misma fuente de verdad (Jitsi cuando la sala es real). Se eliminó la contradicción “Ambos conectados” + “Nadie ha entrado”.
- **2.5b Cámara y micrófono:** completado. `getUserMedia` con timeout de 12 s, clasificación de errores, selección de dispositivos, reintento y mensajes accesibles. Pendiente prueba manual en navegadores y decisión de producto sobre `conferenceFailed`.
- **2.6 Cobro y pago:** completado. `pause`, `leave` y cierre por falta de créditos reconcilian presencia antes de acumular. Se validan claves Stripe test/live. Webhooks con firma e idempotencia ya cubiertos por tests.
- **3.3 Vigencia del prerender:** completado. `FRONTEND_DEPLOY_HOOK_URL` dispara rebuild al aprobar/editar médicos o cambiar su foto. OG de perfiles correcto.
- **3.4 Sitemap y noindex:** completado. Sitemap solo con rutas públicas, `/login` y `/register` fuera; rutas privadas con `noindex` en cliente y guía de `X-Robots-Tag` en Render. Pendiente configurar Search Console/Bing.
- **5.2 Errores de formulario:** completado. Resumen de errores en Login, Registro y postulación médica; foco al primer campo inválido; `aria-describedby` en campos personalizados.
- **5.4 Estados de carga:** completado. Búsqueda muestra “Buscando…” y skeleton durante debounce/carga, sin “Resultados (0)” prematuro. La guía IA ya tenía skeleton y “Pensando…”.
- **5.1 Cabecera móvil:** completado. Menú compacto en móvil, logo ajustado, objetivos táctiles de 44 px y dropdown sin desbordar.
- **5.3 Contraste y estados accesibles:** completado. `aria-pressed`/`aria-selected` presentes; axe-core con 0 violaciones en rutas públicas (desktop/móvil) y autenticadas (paciente, médico, admin, revisor y soporte).
- **6.1 Regresión automática:** preparada y ejecutada. `scripts/regression.sh` corre migraciones, tests, lint, TypeScript, build y opcionalmente producción/accesibilidad. Evidencia en `docs/evidencias/2026-10-21/regresion-6-1.md`.
- **6.2 Regresión manual:** checklist en `docs/regresion-6-1-6-2.md`. Pendiente ejecutarla antes de producción; la videollamada queda bloqueada hasta Jitsi self-hosted.
- **5.5 Localización y zona horaria:** completado. Zonas con Perú primero y etiquetas `Lima (UTC−5)`, países priorizados, buscador de país con datalist, teléfonos sin doble `+` y tests. Los nombres de ciudades siguen viniendo del dataset, pero el campo permite escribir o elegir con datalist.
- **5.6 Validación de datos seed:** completado. Campos `is_seed`/`is_published`, filtros públicos, seed bloqueado en producción y script `validate_seed_data.py`. Pendiente ejecutarlo contra producción antes del lanzamiento real.
- **4.2 CSP en bloqueo:** completado y verificado en producción. CSP incluye `worker-src`, `manifest-src`, `frame-ancestors` y `upgrade-insecure-requests`; `verify:prod` lo confirma.
- **1.4 Consentimientos:** completado. Modelo `Consent`, migración 041, endpoints de consulta/revocación, registro al reservar, en Triage y en la postulación médica; consentimientos separados en la reserva y UI de revocación en Seguridad.
- **1.5 Legal:** parcial. Documentos versión 1.0 sin “Borrador provisional”, enlaces desde registro/reserva/triaje/sala/pie y consentimiento registrado al registrarse. Pendiente aprobación formal por asesoría legal y revisión de menores/DPA.
- **4.5 Secretos y CORS:** completado. Producción exige HTTPS, rechaza `*`/localhost, CORS con headers acotados y documento de rotación de secretos.

---

## 1. Cómo leer este plan

Cada tarea tiene:

- **Prioridad:** `P0` bloquea producción, `P1` antes de abrir al público, `P2` siguiente iteración.
- **Tipo:** `D` despliegue/configuración, `C` código, `O` operación/datos, `V` verificación, `X` decisión.
- **Esfuerzo:** `S` ≤ 0,5 día, `M` 1–2 días, `L` 3–5 días, `XL` > 1 semana.

### Lo que NO se debe rehacer

Ya existe en el repositorio y solo requiere verificación o ajuste:

| Tema | Archivo / evidencia |
|---|---|
| Números de emergencia por país | `apps/web/src/utils/emergencyNumbers.ts` |
| Alertas de síntomas de alarma | `apps/web/src/utils/symptomAlerts.ts` + `Specialties.tsx` |
| Historial estable de la guía IA | `apps/web/src/pages/Guide.tsx` |
| Páginas de privacidad, términos y telemedicina | `Privacy.tsx`, `Terms.tsx`, `Telemedicine.tsx` |
| Metadatos por ruta en build | `apps/web/scripts/generate-meta-pages.mjs` |
| 404 HTML y reglas de cabeceras/caché | `apps/web/public/404.html`, `_headers`, `_redirects` |
| Bloqueo de inicio sin ambos participantes en Jitsi | `video_session_service.both_participants_present()` |
| Etiquetas de costo/reembolso en citas | `MyAppointments.tsx` |
| URL de notificaciones sin doble barra | `apps/web/src/api/client.ts` |

**No reimplementar SSR desde cero.** Ya hay prerender de metadatos; el problema principal es que producción no sirve esos HTML ni aplica las reglas.

---

## 2. Estado de partida

### Repositorio

- La mayoría de fixes de la auditoría del 13/10 ya están implementados.
- No hay entorno de staging configurado en el repo.
- No hay framework E2E instalado (no hay Playwright/Cypress).
- No existe un campo `is_published` ni `is_seed` en médicos.
- `JitsiMeeting.tsx` solo escucha `videoConferenceJoined` y `readyToClose`.
- El guion de introducción médica sigue mencionando transcripción aunque la función no está activa.

### Producción (verificado el 19/10/2026)

- `/como-funciona`, `/specialties/cardiologia`, `/privacidad` y `/emergency` **sin barra final** devuelven metadatos de portada.
- Con barra final sí devuelven los metadatos correctos.
- El sitemap publica las URLs **sin** barra final.
- `_headers` no se aplica: no hay CSP, `Referrer-Policy`, `Permissions-Policy` ni `X-Frame-Options` en el frontend.
- Los assets siguen con `Cache-Control: public, max-age=0, s-maxage=300`.
- `manifest.webmanifest` responde `binary/octet-stream`.
- Rutas inexistentes devuelven HTTP 200 con `robots=index,follow`.
- `Dr. Test` sigue publicado, verificado, con disponibilidad y reservable.
- La API pública responde en `https://sabiodoc.onrender.com`.

**Conclusión:** el problema dominante es de despliegue y configuración, no de desarrollo.

---

## 3. Decisiones bloqueantes

Sin estas decisiones, varias tareas no se pueden cerrar.

| ID | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | Proveedor de videollamada | JaaS, Jitsi self-hosted o `meet.jit.si` | **Decidido: Jitsi self-hosted**, necesario para la transcripción. Pendiente de provisión y credenciales. |
| D2 | Estrategia de SEO y 404 | SSR, edge function o prerender + redirects | Prerender + barra final, sin reglas comodín para rutas dinámicas. Los médicos nuevos requieren redespliegue; se reconsidera edge/SSR si el volumen lo exige. |
| D3 | Transcripción | Funcionalidad prevista para producción; aún no implementada | Mantener el copy preparado como funcionalidad prevista. No presentarla como activa hasta implementar consentimiento específico, retención y proveedor. |
| D4 | Alcance legal | Perú solamente o varios países | Definir país(es) antes de aprobar políticas y consentimientos. |
| D5 | Staging | Servicio aparte o preview por rama | Servicio aparte con BD, Jitsi, correo y Cloudinary separados. |
| D6 | Pagos | Solo créditos ficticios o PSP real | Mantener ficticio hasta cerrar P0; separar claves test/live y webhooks. |

---

## 4. Fases y tareas

## Fase 0 — Paridad repo-producción y operación segura (P0)

**Objetivo:** que producción sirva exactamente lo que el repositorio ya tiene y que exista un entorno seguro para probar.

### 0.1 Configurar correctamente Render (D, M)

- Eliminar el catch-all/rewrite que envía todo a `index.html`.
- Aplicar `_redirects` o configurar las rewrites de la SPA en el dashboard.
- Servir `404.html` con HTTP 404 real.
- Definir una política única de barra final:
  - Recomendado: usar barra final en rutas prerenderizadas y redirigir 301 la versión sin barra.
  - Actualizar sitemap, canonical y OG a la misma forma.
- Verificar que el build desplegado coincide con el commit esperado.

**Aceptación:** los comandos de la sección 6 devuelven los valores esperados; `/ruta-inexistente` responde 404; `/como-funciona` y `/como-funciona/` no sirven metadatos distintos.

> Las cabeceras, el MIME del manifest y la caché se cierran en la Fase 4; aquí solo se deja la base de despliegue.

### 0.2 Verificación de producción (V, S)

- Ejecutar la matriz de `curl` de la sección 6 y guardar la salida.
- Revisar en navegador: emergencias, síntomas, guía, privacidad, telemedicina, términos y Dr. Test.
- Comparar el hash del bundle desplegado con el build local.
- Registrar diferencias en `docs/evidencias/2026-10-19/`.

**Aceptación:** informe breve con “esperado / obtenido / pendiente” por cada punto.

### 0.3 Retirar datos de prueba de producción (O, S)

- Marcar `Dr. Test` como no reservable y fuera del directorio.
- Decidir el mecanismo: `status=rejected/suspended` o nuevo campo `is_published=false`.
- Excluirlo de sitemap, datos estructurados, especialidades y búsqueda.
- Conservar el registro si existen citas históricas.
- Revisar también médicos demo con correos `*.demo@` o nombres reales.
- Añadir validación de despliegue para datos seed.

**Aceptación:** `/doctors/2` no aparece en API pública, sitemap ni directorio; una reserva nueva no puede seleccionarlo.

### 0.4 Crear staging (D/O, L)

- Duplicar frontend, API y base de datos en un entorno separado.
- Separar secretos de Jitsi, SMTP, Cloudinary, pagos y analítica.
- Cargar solo usuarios, síntomas, citas y créditos sintéticos.
- Mostrar una etiqueta visible de “Entorno de pruebas”.
- Probar restauración de un backup antes de usarlo.

**Aceptación:** staging funciona sin compartir credenciales, citas ni saldos con producción; el restore se ejecutó al menos una vez.

### 0.5 Observabilidad mínima (D/C, M)

- Confirmar logs estructurados con `request_id`.
- Registrar eventos de Jitsi y errores de medios con ID de cita no sensible.
- Redactar correos, nombres clínicos y síntomas de los logs.
- Definir alertas para errores 5xx, cobros sin presencia y fallos de webhooks.

**Aceptación:** un error provocado en staging aparece en logs con ID correlacionable y sin datos clínicos.

---

## Fase 1 — Seguridad clínica y consentimientos (P0)

**Objetivo:** que las correcciones clínicas ya implementadas queden verificadas, probadas y aprobadas.

### 1.1 Revisión editorial de emergencias (V/O, S)

- Verificar por país los números y notas de `emergencyNumbers.ts`.
- Confirmar que Perú no presenta 911 como número único.
- Añadir fecha y fuente visibles.
- Añadir prueba que falle si se publica `tel:911` para Perú como única línea.

**Aceptación:** revisión clínica firmada y test en verde.

### 1.2 Regresión de síntomas de alarma (V/C, S)

- Probar en producción: dolor/presión en el pecho, disnea, ACV, sangrado abundante, convulsiones, anafilaxia y pérdida de conciencia.
- Confirmar que el banner aparece antes que los resultados.
- Añadir casos al test de `symptomAlerts`.
- Revisar que búsqueda por nombre no muestre una especialidad irrelevante como única respuesta.

**Aceptación:** todos los casos muestran aviso de urgencia y no una recomendación clínica normal.

### 1.3 Preparar la transcripción (C, S)

- Mantener en el guion de `video_session_service.py` la mención de que la sesión puede ser transcrita y la identificación de voces.
- Mantener en `VideoConsultationRoom.tsx` la instrucción de identificar voces.
- Mantener `Privacy.tsx` y `Telemedicine.tsx` describiendo la transcripción como funcionalidad prevista.
- Antes de activarla: consentimiento específico, proveedor, retención y DPA.

**Aceptación:** el copy queda preparado y consistente; la activación técnica queda bloqueada hasta cerrar 1.4.

### 1.4 Consentimientos separados y versionados (C/O, L)

- Crear modelo de consentimientos con: usuario, cita, tipo, versión, fecha, revocación.
- Separar términos, privacidad, tratamiento clínico, videoconsulta, transcripción, grabación y comunicaciones comerciales.
- No preseleccionar consentimientos opcionales.
- Registrar la versión aceptada en cada cita.
- Añadir aviso contextual antes de enviar síntomas o antecedentes.
- Definir flujo de revocación y re-consentimiento.

**Aceptación:** el backend puede demostrar qué versión aceptó cada usuario y cada cita.

### 1.5 Documentos legales y encargados (O, L)

- Asignar versión y fecha a privacidad, términos y telemedicina.
- Identificar responsable y contacto de privacidad.
- Documentar encargados: Jitsi/JaaS, Cloudinary, LLM, SMTP y pagos.
- Definir conservación, eliminación, exportación y transferencias.
- Revisar menores, datos clínicos y telemedicina con asesoría local.

**Aceptación:** documentos aprobados, versionados y enlazados desde registro, reserva, triaje, sala y pie.

---

## Fase 2 — Jitsi, presencia y cobro (P0)

**Objetivo:** que la videollamada funcione de extremo a extremo y que el cobro dependa de presencia real.

### 2.1 Decidir proveedor (X, S)

- Comparar JaaS, Jitsi self-hosted y `meet.jit.si`.
- Criterios: moderación, JWT, coste, DPA, retención, grabación, latencia y soporte.
- Documentar la decisión y su impacto en la Fase 1.5.

**Aceptación:** decisión firmada; si se elige `meet.jit.si`, se acepta explícitamente que el médico no puede ser moderador exclusivo.

### 2.2 Configurar JWT y moderación (C/D, M)

- Emitir token corto por cita, usuario y rol.
- Conceder moderación solo al médico.
- Validar identidad del paciente en la aplicación.
- Invalidar token al cancelar, finalizar o vencer.
- Si se usa JaaS/self-hosted, configurar `JITSI_JWT_SECRET` y dominio.
- Si se usa `meet.jit.si`, no enviar JWT y rediseñar la sala.

**Aceptación:** el médico entra como moderador y un usuario ajeno no puede reutilizar el enlace.

### 2.3 Migrar salas antiguas (O/C, S)

- Buscar en BD salas con IP privada, `localhost` o certificado inválido.
- Regenerar o invalidar esas salas antes de producción.
- Añadir prueba que falle si `JITSI_BASE_URL` es privado en producción.

**Aceptación:** ninguna cita existente apunta a `192.168.1.123:7443` ni a un host local.

### 2.4 Eventos reales de Jitsi (C, M)

- Escuchar `participantJoined`, `participantLeft`, `videoConferenceLeft`, `conferenceFailed`, `connectionFailed` y `errorOccurred`.
- Distinguir participante local de remoto.
- Enviar heartbeat mientras el usuario permanece conectado.
- Caducar presencia si falta heartbeat o hay desconexión.
- No derivar presencia de la ruta `/video-room`.

**Aceptación:** abrir la página sin entrar a Jitsi no habilita el cronómetro; una desconexión pausa o falla la sesión según la política.

### 2.5 Máquina de estados y mensajes (C, M)

- Mapear los estados propuestos al enum existente: `prepared`, `active`, `completed`, `cancelled`, `expired`, `failed`.
- Unificar la fuente de verdad de presencia, botón y cronómetro.
- Eliminar mensajes contradictorios (“Ambos conectados” + “Nadie ha entrado”).
- Mostrar una sola razón de bloqueo.
- Corregir contadores y listas que se contradicen.

**Aceptación:** la interfaz nunca contradice el estado del backend y el costo permanece en US$0,00 hasta que la sala esté lista.

### 2.6 Salvaguardas de cobro y pago (C/O, L)

- Mantener el inicio bloqueado hasta que ambos estén en Jitsi.
- No cobrar ante fallo de medios, espera de moderador o desconexión.
- Separar claves test/live del proveedor de pago.
- Validar firma de webhooks e idempotencia.
- Conciliar duración, costo, reembolso, comisión e ingreso médico.
- Alertar por cobro sin duración o sin presencia confirmada.
- Revisar que la etiqueta de la cita use costo final, no retención.

**Aceptación:** no existe cobro sin evidencia de consulta; la conciliación coincide con los movimientos de billetera.

### 2.7 E2E de dos usuarios (C/D, L)

- Instalar Playwright.
- Usar dos contextos aislados, uno paciente y otro médico.
- Configurar cámara y micrófono simulados.
- Crear cita sintética y entrar desde ambos perfiles.
- Verificar que cada cliente detecta al participante remoto.
- Desconectar al paciente y comprobar que el botón se bloquea.
- Comparar duración, costo, reembolso y comisión con el backend.

**Aceptación:** la prueba pasa de forma repetible en CI y falla si se intenta cobrar con un solo participante.

---

## Fase 3 — SEO y despliegue correcto (P1)

**Objetivo:** que buscadores y redes reciban el HTML correcto, sin soft 404.

### 3.1 Unificar barra final y canonical (D/C, M)

- Elegir barra final para rutas prerenderizadas.
- Redirigir 301 la forma alternativa.
- Actualizar sitemap, canonical, OG y enlaces internos.
- Verificar que el HTML servido en la URL canónica tiene los metadatos correctos.

**Aceptación:** la URL del sitemap, el canonical y el HTML servido coinciden.

### 3.2 404 real para las tres clases de URL (D/C, M)

- Ruta genérica inexistente.
- Especialidad inexistente.
- Médico inexistente.
- Añadir `noindex, follow` y retirar canonical autorreferente.
- Excluir del sitemap.
- No usar reglas comodín para `/specialties/:slug` ni `/doctors/:id`: provocan 200 vacío o bucles. La forma sin barra cae en `404.html`, que redirige al cliente; los médicos nuevos requieren rebuild.

**Aceptación:** las tres clases devuelven HTTP 404 o, como mínimo, `noindex` real y ausencia de sitemap; la decisión está documentada.

### 3.3 Vigencia del prerender (C/D, M)

- Definir cuándo se regeneran especialidades y médicos.
- Añadir rebuild programado o invalidación al publicar un médico.
- Verificar que un médico nuevo no queda sin metadatos.
- Corregir tipo, dimensiones y alt de OG en perfiles con foto.

**Aceptación:** un médico publicado después del build tiene metadatos correctos o se documenta su ventana de espera.

### 3.4 Sitemap, robots y datos estructurados (C, S)

- Incluir solo páginas públicas válidas y perfiles publicados.
- Excluir login, registro, recuperación y áreas privadas.
- Añadir `noindex` real a páginas privadas.
- Revisar `Organization`, `WebSite`, `Physician`, `MedicalSpecialty`, `BreadcrumbList` y `FAQPage`.
- Configurar Search Console y Bing Webmaster.

**Aceptación:** sitemap y robots coinciden con el inventario público; no hay soft 404 en Search Console.

---

## Fase 4 — Seguridad y caché (P1)

**Objetivo:** aplicar las cabeceras que ya están escritas y cerrar la caché clínica.

### 4.1 Aplicar cabeceras en producción (D, S)

- CSP, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` o `frame-ancestors`, COOP/CORP.
- Verificar que Render aplica `_headers`; si no, configurar en el dashboard.

**Aceptación:** `curl -I` muestra las cabeceras esperadas en frontend y API.

### 4.2 Pasar CSP a modo bloqueo (C/D, M)

- Probar primero en `Report-Only` (ya existe).
- Definir `frame-src`, `script-src`, `connect-src` y `media-src` para el proveedor real.
- Añadir `frame-ancestors 'none'`.
- Revisar reportes antes de bloquear.

**Aceptación:** la aplicación funciona con CSP aplicada y el escáner no reporta cabeceras esenciales ausentes.

### 4.3 Corregir caché (D/C, S)

- Assets con hash: `public, max-age=31536000, immutable`.
- HTML: `no-cache` o `max-age=0, must-revalidate`.
- Respuestas clínicas: `no-store`.
- Verificar en pipeline.

**Aceptación:** assets reutilizados; HTML se revalida; datos clínicos no quedan en caché compartida.

### 4.4 Manifest y tipos MIME (D, S)

- Servir `manifest.webmanifest` como `application/manifest+json`.
- Revisar tipos de JS, CSS e imágenes.

**Aceptación:** `curl -I` devuelve el MIME correcto.

### 4.5 Secretos y CORS (O/C, M)

- Rotar secretos expuestos o débiles.
- Separar CORS de staging y producción.
- Revisar dependencias y permisos.

**Aceptación:** staging no puede llamar a la API de producción y no hay secretos en el frontend.

---

## Fase 5 — UX, accesibilidad y datos (P2)

### 5.1 Cabecera móvil (C, S)

- Separar marca y “Iniciar sesión”.
- Menú compacto por debajo del breakpoint.
- Objetivos táctiles de al menos 44×44 px.
- Revisar 320, 375, 390 y 768 px.

**Aceptación:** sin solapamiento ni desbordamiento; foco visible.

### 5.2 Errores de formulario (C, M)

- Mover foco al primer campo inválido.
- `aria-invalid` y `aria-describedby`.
- Resumen de errores cuando haya varios.
- Conservar valores tras el error.

**Aceptación:** cada error se anuncia y el foco llega al campo correcto.

### 5.3 Contraste y estados accesibles (C, M)

- Revisar CTA verde, aviso amarillo y subtítulo rojo.
- Añadir `aria-pressed` o radios a los horarios.
- Revisar enlaces táctiles pequeños.
- Verificar WCAG 2.2 AA con herramienta.

**Aceptación:** contraste y estados seleccionados conformes.

### 5.4 Estados de carga (C, S)

- Evitar “Resultados (0)” mientras se filtra.
- Mostrar skeleton o conservar resultados anteriores.
- Añadir estado de carga real en la guía IA.

**Aceptación:** no se muestra “sin resultados” antes de terminar la búsqueda.

### 5.5 Localización y zona horaria (C, M)

- Traducir países y ciudades al español.
- Priorizar Perú y países con operación.
- Añadir búsqueda/autocompletado.
- Mostrar “Lima (UTC−5)” y conservar IANA internamente.
- Corregir doble signo `+` en teléfonos.
- Revisar tildes: `médicos`, `Perú`, `Médico no encontrado`.

**Aceptación:** un usuario de Perú completa ubicación, teléfono y zona sin listas globales extensas.

### 5.6 Datos seed y validación de despliegue (C/O, M)

- Añadir `is_seed` y `is_published` a médicos.
- Crear seeds solo en desarrollo/staging.
- Validar en despliegue que no haya perfiles `Test`, `Demo`, `QA` o `Example` publicados.
- No depender solo del nombre: revisar correos `*.demo@` y datos ficticios.

**Aceptación:** producción no publica datos seed y el despliegue falla o alerta si los detecta.

---

## Fase 6 — Regresión y liberación (P0)

### 6.1 CI obligatorio (D/C, S)

- Backend: `pytest app/tests -q`.
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.
- E2E de dos usuarios en CI.
- Pruebas de cabeceras, 404, metadatos y manifest.

**Aceptación:** pipeline en verde y artefactos guardados.

### 6.2 Regresión manual (V, M)

- Registro, login, recuperación y cierre de sesión.
- Orientación sintética y alertas de emergencia.
- Reserva y reprogramación con créditos ficticios.
- Llamada con dos participantes y medios simulados.
- Bloqueo de cobro, inicio, interrupción, cierre y liquidación.
- Políticas, consentimientos, 404, metadatos, responsive y accesibilidad.
- Consola, red, cabeceras y caché.

**Aceptación:** informe con evidencia y todas las pruebas obligatorias en verde.

### 6.3 Despliegue progresivo (D/O, M)

- Desplegar primero en staging.
- Llamada manual desde dos equipos y redes distintas.
- Publicar en producción para grupo reducido.
- Monitorizar fallos de Jitsi, medios, citas no iniciadas, desconexiones y reembolsos.
- Documentar y probar rollback de aplicación y base de datos.
- Habilitar cobros reales solo después de aprobar la llamada de extremo a extremo.

**Aceptación:** rollback probado; métricas vigiladas; no existe cobro sin evidencia de consulta.

---

## 5. Orden recomendado y esfuerzo

| Orden | Tarea | Prioridad | Esfuerzo | Dependencia |
|---:|---|---|---|---|
| 1 | 0.1 Configurar Render | P0 | M | — |
| 2 | 0.2 Verificación de producción | P0 | S | 0.1 |
| 3 | 0.3 Retirar Dr. Test | P0 | S | 0.2 |
| 4 | 1.1–1.3 Emergencias, síntomas y transcripción | P0 | S–M | — |
| 5 | 2.1 Decisión Jitsi | P0 | S | D1 |
| 6 | 2.2–2.5 JWT, eventos, estados y mensajes | P0 | L | 2.1 |
| 7 | 2.6 Salvaguardas de cobro | P0 | L | 2.2–2.5 |
| 8 | 2.7 E2E dos usuarios | P0 | L | 2.2–2.6 |
| 9 | 0.4 Staging | P0 | L | 0.1 |
| 10 | 1.4–1.5 Consentimientos y legal | P0 | L | D3/D4 |
| 11 | 3.1–3.4 SEO y 404 | P1 | M | 0.1/D2 |
| 12 | 4.1–4.4 Cabeceras y caché | P1 | M | 0.1 |
| 13 | 5.1–5.5 UX y accesibilidad | P2 | M | Flujos estables |
| 14 | 5.6 Datos seed | P2 | M | 0.3 |
| 15 | 6.1–6.3 Regresión y liberación | P0 | L | Fases anteriores |

**Paralelización razonable:** 0.1/0.2/0.3, 1.1–1.3 y 2.1 pueden ir en paralelo. 2.2–2.7 no debe empezar sin la decisión de Jitsi. 3.x y 4.x pueden ir en paralelo con 2.x siempre que no toquen el mismo despliegue.

---

## 6. Evidencia mínima

Guardar en `docs/evidencias/AAAA-MM-DD/`.

### Cabeceras y caché

```bash
curl -sI https://sabiodoc-1.onrender.com/ | grep -iE 'HTTP/|content-security|referrer|permissions|x-frame|cache-control'
curl -sI https://sabiodoc-1.onrender.com/assets/<hash>.js | grep -i 'cache-control'
curl -sI https://sabiodoc-1.onrender.com/manifest.webmanifest | grep -i 'content-type'
```

### 404 y metadatos

```bash
for u in /ruta-inexistente /specialties/slug-que-no-existe /doctors/999999; do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' https://sabiodoc-1.onrender.com$u)"
done

curl -s https://sabiodoc-1.onrender.com/como-funciona/ | grep -iE '<title>|og:url|canonical|robots'
curl -s https://sabiodoc-1.onrender.com/specialties/cardiologia/ | grep -iE '<title>|og:url|canonical|robots'
```

### Datos de prueba

```bash
curl -s https://sabiodoc.onrender.com/doctors/specialty/cardiologia | grep -o 'Dr[^"]*Test' || echo 'sin Dr. Test'
curl -s https://sabiodoc-1.onrender.com/sitemap.xml | grep -i 'doctors/2' || echo 'Dr. Test fuera del sitemap'
```

### Pruebas

```bash
cd apps/api && pytest app/tests -q
cd apps/web && npm run lint && npx tsc --noEmit && npm test && npm run build
```

---

## 7. Checklist de liberación actualizada

- [ ] Producción sirve el mismo build verificado en staging.
- [ ] Render aplica cabeceras, redirects, 404, MIME y caché.
- [ ] La URL canónica y el HTML servido coinciden (barra final incluida).
- [ ] Rutas inexistentes devuelven 404 o `noindex` real y no están en sitemap.
- [ ] `Dr. Test` y cualquier dato seed están fuera del sitio público.
- [ ] Emergencias y síntomas de alarma tienen revisión clínica y tests.
- [ ] La transcripción descrita coincide con la función real.
- [ ] Consentimientos separados, versionados y registrados.
- [ ] Jitsi une a paciente y médico con audio y video.
- [ ] El médico es moderador o la limitación está aceptada y documentada.
- [ ] Ninguna cita existente apunta a un host privado.
- [ ] El cronómetro no inicia sin ambos participantes en Jitsi.
- [ ] No existe cobro sin presencia confirmada.
- [ ] CSP, `Referrer-Policy`, `Permissions-Policy` y framing aplicados.
- [ ] Assets inmutables y datos clínicos con `no-store`.
- [ ] Formularios anuncian errores y mueven el foco.
- [ ] Responsive y contraste revisados.
- [ ] E2E de dos usuarios en verde.
- [ ] Regresión manual y llamada desde dos redes aprobadas.
- [ ] Rollback de aplicación y base de datos probado.
- [ ] Evidencias guardadas y acta de aprobación firmada.
