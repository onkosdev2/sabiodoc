# Auditoría integral de SabioDoc

**Sitio auditado:** https://sabiodoc-1.onrender.com/  
**Fecha:** 13 de octubre de 2026  
**Alcance completado:** superficie pública, SEO técnico, responsive, accesibilidad, rendimiento observado, administración de usuarios, creación y acceso de paciente, créditos ficticios, dos reservas reales de prueba, panel médico, entrada de ambos roles, cronómetro, cierre y liquidación.  
**Pendiente para cerrar el producto completo:** médico pendiente, revisor y soporte; recuperación/verificación por correo; chat, carga de archivos, retiros y una videollamada WebRTC con audio/video realmente unidos. La URL pública de Jitsi fue corregida para sesiones nuevas, pero la conferencia queda esperando moderador.

## Resumen ejecutivo

La base visual y técnica es buena: el sitio se siente coherente, carga con rapidez, la estructura semántica es superior a la media y las principales rutas públicas funcionan sin errores de consola. Sin embargo, **no lo consideraría listo para operar como producto de salud** hasta resolver tres riesgos críticos activos:

1. La página de emergencias ofrece `911` como número general, aunque en Perú la central 911 todavía está en implementación/pruebas limitadas; las líneas oficiales vigentes incluyen SAMU 106, Bomberos 116 y Policía 105.
2. La búsqueda anunciada “por síntomas” puede orientar síntomas urgentes de forma incorrecta: “dolor en el pecho” devolvió Anestesiología, mientras “presión en el pecho”, “dificultad para respirar” y “sangrado abundante” devolvieron cero resultados.
3. Una cita nueva carga correctamente `meet.jit.si`, pero paciente y médico quedan en `Asking to join meeting…` porque no llega un moderador. SabioDoc, aun así, los marca como conectados, permite iniciar el cronómetro y cobra.

El host privado de Jitsi observado inicialmente fue **corregido para citas nuevas**. En la cita #4, ambos roles cargaron `https://meet.jit.si/external_api.js` y el mismo identificador de sala. El problema activo ya no es TLS o accesibilidad del host, sino autenticación/moderación y la falta de vinculación entre el estado real de Jitsi y el cobro de SabioDoc.

También hay problemas importantes de SEO (soft 404, metadatos solo en cliente), confianza (un perfil `Dr. Test` está publicado e indexado), consistencia de la guía IA y privacidad/legal.

### Valoración heurística

| Área | Resultado | Comentario |
|---|---:|---|
| Funcionalidad pública | 7/10 | Buena cobertura, pero búsqueda clínica y retroceso de la guía fallan |
| Flujos autenticados | 6/10 | Reserva, cronómetro y liquidación funcionan; la conferencia WebRTC no llega a unir a paciente y médico |
| Diseño escritorio | 8/10 | Limpio, profesional y consistente |
| Diseño móvil | 6.5/10 | Sin desbordamiento, pero cabecera y algunas tarjetas quedan apretadas |
| Accesibilidad | 7/10 | Buena semántica; faltan contraste, foco y estados accesibles |
| SEO | 5/10 | Sitemap/canonical dinámico bien encaminados; CSR y soft 404 penalizan |
| Rendimiento observado | 8/10 | Carga rápida; API y caché aún mejorables |
| Seguridad y confianza | 5.5/10 | HSTS/CORS y Jitsi público correctos; aún faltan políticas, consentimientos y cabeceras |

Estas puntuaciones son heurísticas de auditoría, no resultados de Lighthouse.

## Cobertura realizada

- Se descubrieron **63 patrones de ruta** en el cliente.
- El sitemap contiene **45 URLs**.
- Se validaron las **36 especialidades** contra la API: 36/36 respondieron correctamente.
- Se validaron los **2 perfiles médicos** publicados: 2/2 respondieron correctamente.
- Se recorrieron las plantillas públicas: portada, Cómo funciona, especialidades, detalle, guía IA, triaje libre, emergencias, postulación médica, perfil de médico, login, registro, recuperación, cambio/verificación de correo y 404.
- Se probó la postulación médica hasta el tercer paso, con datos sintéticos, sin enviar la solicitud.
- Se creó desde administración un paciente sintético y se comprobó su acceso.
- Se recargaron US$5,00 de dinero ficticio; el movimiento apareció correctamente en la billetera.
- Se reservó la primera cita disponible con Dr. Test: 13/10/2026 14:15, 15 minutos, US$1,50 retenidos.
- La misma cita apareció como “Programada” en paciente y médico, con la sala habilitada.
- Se entró como médico a la preparación de la sala; el estado cambió a conectado a las 14:18.
- Se documentó el fallo inicial de Jitsi con una URL privada y certificado inválido; posteriormente se repitió el flujo autenticado con una cita creada después del despliegue.
- Se reservó una segunda cita de 15 minutos para el 13/10/2026 a las 15:00, con US$1,50 retenidos.
- En la cita nueva, paciente y médico cargaron `external_api.js` y el mismo iframe desde `https://meet.jit.si`, sin advertencia TLS ni referencia a la IP privada.
- Se inició y finalizó la consulta a los 7 segundos: coste real US$0,10, reembolso al paciente US$1,40, comisión US$0,02 e ingreso médico US$0,08.
- Jitsi no unió a los dos participantes: ambos mostraron `Asking to join meeting…` y la ausencia de moderador mientras SabioDoc indicaba `Ambos conectados`.
- Se verificaron redirecciones a login para rutas privadas representativas de paciente, médico, revisor, soporte y administrador.
- Responsive probado a 390×844 y 1440×900 px.
- No se enviaron síntomas, solicitudes, correos, notas clínicas ni archivos. Solo se usaron datos sintéticos y créditos ficticios.

## Hallazgos críticos

### C-01 — Número de emergencias potencialmente incorrecto

**Evidencia:** `/emergency` muestra “Emergencias: 911” y enlaza a `tel:911`. El sitio publica médicos en Lima/Perú y la postulación selecciona Perú, por lo que el contexto aparente es peruano.

Al 13 de octubre de 2026, fuentes oficiales indican que la central 911 sigue en implementación y que las llamadas reales se han atendido en una fase de pruebas limitada. El Ministerio de Salud mantiene **SAMU 106** para urgencias médicas; las líneas consolidadas incluyen **105 Policía**, **106 SAMU** y **116 Bomberos**.

**Riesgo:** retraso real en una urgencia médica.

**Corrección recomendada:**

- Sustituir el único número por un bloque geolocalizado y verificado: SAMU 106, Bomberos 116, Policía 105 y orientación 113 para Perú.
- No presentar 911 como universal mientras no esté plenamente operativo en el territorio objetivo.
- Pedir país/ciudad o explicar claramente el alcance geográfico.
- Mantener los números y textos clínicos bajo revisión editorial con fecha y fuente.

Fuentes oficiales: [MINSA — solicitar atención médica de emergencia](https://www.gob.pe/1013), [MINSA — teléfonos de emergencia](https://www.gob.pe/institucion/minsa/contacto-y-numeros-de-emergencias), [MTC — fase de pruebas del 911](https://www.gob.pe/institucion/mtc/noticias/1395664-emergencias-911-atiende-con-exito-sus-primeras-llamadas-reales-durante-fase-de-pruebas), [Pronatel — avance de la futura central 911](https://www.gob.pe/institucion/pronatel/noticias/1427994-central-emergencias-911-supera-el-50-de-avance-en-su-construccion).

### C-02 — Búsqueda por síntomas con resultados clínicamente inseguros

**Evidencia observada tras esperar el filtrado:**

| Consulta | Resultado |
|---|---|
| `dolor en el pecho` | Anestesiología |
| `presión en el pecho` | 0 resultados |
| `dificultad para respirar` | 0 resultados |
| `sangrado abundante` | 0 resultados |
| `infarto` | Cardiología |

**Riesgo:** la interfaz promete encontrar especialidad “por síntomas”, pero puede silenciar una urgencia o mostrar una especialidad irrelevante.

**Corrección recomendada:**

- Antes de buscar especialidades, clasificar expresiones de alarma y mostrar un banner de urgencia.
- Para dolor torácico, disnea, signos neurológicos, sangrado abundante, pérdida de conciencia, convulsiones y reacciones alérgicas graves, priorizar emergencias, no un filtro léxico.
- Separar “buscar por nombre” de “orientarme por síntomas”; la segunda acción debe usar el flujo de triaje con reglas clínicas y supervisión.
- Añadir pruebas automatizadas con un conjunto de síntomas de alarma y resultados esperados.
- Mientras llega la corrección, cambiar el texto a “buscar por nombre o palabras clave” y retirar la promesa de síntomas.

### C-03 — RESUELTO EN REPRUEBA: configuración Jitsi privada

**Estado actual:** corregido para citas nuevas y revalidado el 13/10/2026. En la cita #4, ambos roles cargaron `https://meet.jit.si/external_api.js` y el iframe `https://meet.jit.si/SabioDoc-sabiodoc-appt-4-7122bb2e8e-abf4a3...`; no apareció el error del API ni una advertencia de certificado.

La cita #3, creada antes del despliegue, siguió entregando al médico `https://192.168.1.123:7443/external_api.js` aun después de borrar caché HTTP, service worker y Cache Storage. Paciente y médico cargaban el mismo bundle `/assets/index--Jco8R61.js`, pero recibían dominios Jitsi distintos. Esto indica datos persistidos en la sesión antigua, no caché local, y requiere migración o invalidación de salas preexistentes.

**Evidencia histórica previa a la corrección:** se creó y pagó con saldo ficticio una cita de 15 minutos. Paciente y médico mostraron la cita como programada y la sala disponible. En los intentos iniciales:

- la aplicación marcó al médico como `Conectado 14:18`;
- el área de video mostró `No se pudo cargar el API de Jitsi`;
- un segundo intento produjo exactamente el mismo resultado;
- la prueba de cámara/micrófono devolvió `No pudimos acceder`;
- el enlace alternativo real fue `https://192.168.1.123:7443/SabioDoc-...`;
- el navegador bloqueó ese destino con `ERR_CERT_AUTHORITY_INVALID`.

Se realizó además una limpieza profunda del navegador de prueba: caché HTTP, registros de service worker y Cache Storage; se cerró la pestaña, se abrió una nueva y se inició sesión otra vez. En ese momento la aplicación aún entregó el host privado y `external_api.js` falló con `ERR_CERT_AUTHORITY_INVALID`. Este resultado quedó superado por el despliegue posterior verificado en Brave.

Una captura aportada por el usuario mostró una etapa intermedia en Brave en la que el iframe ya renderizaba, aunque Jitsi todavía esperaba moderador. La cita nueva confirmó que la URL pública está activa, pero no eliminó ese bloqueo de moderación.

**Riesgo residual:** las citas creadas antes del despliegue pueden conservar el host privado. Deben migrarse, invalidarse o regenerar su URL antes de permitir el acceso.

**Validación y prevención recomendadas:**

- Mantener `meet.jit.si` o un dominio Jitsi público con TLS válido en todos los entornos de producción.
- Añadir una prueba que falle si el dominio configurado es una IP privada, `localhost` o un certificado inválido.
- Confirmar que el médico recibe el rol necesario para iniciar la sesión sin autenticación externa inesperada.
- Mantener el fallback en la misma URL pública y añadir `rel="noopener noreferrer"`.
- Separar los estados `preparada`, `conectando`, `media conectada` y `en consulta`; no considerar conectado al usuario hasta recibir el evento de unión de Jitsi.
- Si falla Jitsi, liberar o mantener claramente la retención según una política explícita y ofrecer reintento/reprogramación sin cobro.
- Añadir una prueba E2E real con dos navegadores aislados, cámara/micrófono simulados y verificación de audio/video/cronómetro/cobro.

### C-04 — SabioDoc cobra aunque Jitsi no inicia la conferencia

**Evidencia autenticada con una cita nueva:** paciente y médico cargaron exactamente la misma sala `meet.jit.si/SabioDoc-sabiodoc-appt-4-7122bb2e8e-abf4a3`. En ambos iframes apareció `Asking to join meeting…` y el aviso `The conference has not yet started because no moderators have yet arrived`, con botón `Log-in`. Jitsi no mostró dos participantes unidos.

En paralelo, SabioDoc indicó `Ambos conectados`, habilitó `Iniciar consulta` y permitió comenzar el cronómetro. La sesión se cerró a los 7 segundos con un coste mínimo de US$0,10. El paciente recibió US$1,40 de reembolso sobre los US$1,50 retenidos; el médico recibió US$0,08 y la plataforma US$0,02.

**Impacto:** se puede cobrar y completar una consulta sin que exista una conferencia WebRTC operativa. Esto afecta seguridad clínica, confianza, reclamaciones y conciliación financiera.

**Corrección recomendada:**

- Usar un Jitsi propio con autenticación controlada o emitir JWT para que el médico entre como moderador.
- No derivar presencia de la ruta `/video-room`; exigir los eventos `videoConferenceJoined` de ambos roles y al menos un participante remoto visible.
- Mantener `Iniciar consulta` deshabilitado hasta confirmar la unión real de ambos usuarios en Jitsi.
- Si Jitsi entra en espera de moderador, mostrar el error en SabioDoc, impedir el cobro y ofrecer reintento o reprogramación.
- Añadir una prueba E2E con dos perfiles aislados que compruebe `2 participants` antes de iniciar el cronómetro.

## Hallazgos de prioridad alta

### H-01 — Datos de prueba publicados e indexados

`/doctors/2` publica “Dr. Test”, especialidad “Test”, colegiatura `1234`, tarifa `US$ 0,10/min` y disponibilidad amplia. El perfil está incluido en el sitemap y aparece en Cardiología como “Verificado”.

**Impacto:** erosiona confianza, contamina SEO y puede permitir reservas sobre datos ficticios.

**Acción:** eliminar/despublicar el perfil, excluirlo del sitemap y separar estrictamente datos seed/staging de producción.

### H-02 — Soft 404 indexables

Estas rutas inexistentes respondieron **HTTP 200**:

- `/ruta-inexistente-auditoria`
- `/specialties/slug-que-no-existe`
- `/doctors/999999`

Además, el DOM termina con `robots=index,follow` y canonical autorreferente. La UI sí muestra “Página no encontrada”, “Especialidad no encontrada” o “Medico no encontrado”, pero los buscadores reciben 200.

**Acción:** devolver HTTP 404 real desde el servidor/edge o usar SSR; aplicar `noindex` a errores y retirar canonical autorreferente en páginas inexistentes.

### H-03 — SEO y Open Graph dependen de JavaScript

El HTML crudo de `/como-funciona`, `/specialties/cardiologia`, `/doctors/1` y una 404 entrega siempre:

- título de la portada;
- descripción de la portada;
- `og:url=https://sabiodoc-1.onrender.com/`;
- sin canonical de ruta.

El cliente corrige después título, descripción, canonical, Open Graph y JSON-LD. Los bots sociales y rastreadores que no ejecuten JavaScript verán metadatos incorrectos. En el perfil médico, el DOM sí genera `Physician`, pero solo del lado cliente.

**Acción:** SSR/prerender por ruta para páginas públicas. Entregar título, description, canonical, OG/Twitter y JSON-LD en el primer HTML.

### H-04 — Retroceder en la guía IA pierde la respuesta y cambia opciones

La guía llegó correctamente a la pregunta 5/5. Al pulsar “Atrás”:

- apareció “Pensando…” durante varios segundos;
- regresó a la pregunta 4 sin la respuesta seleccionada;
- “Continuar” quedó deshabilitado;
- una opción cambió de “De 1 a 4 semanas” a “Más de una semana”.

**Impacto:** rompe la expectativa de navegación y puede alterar la recomendación para un mismo caso.

**Acción:** persistir un árbol de preguntas/respuestas con IDs estables; volver atrás debe leer el historial local, no regenerar la pregunta con IA.

### H-05 — Falta de políticas visibles para datos de salud e identidad

No se encontraron enlaces públicos a privacidad, términos, tratamiento de datos o política de telemedicina en la cabecera, pie, registro, triaje ni postulación médica. El sitio solicita síntomas, datos clínicos, correo, ubicación, dirección profesional, documento de identidad y registros médicos.

**Acción:** publicar y enlazar políticas; mostrar aviso contextual antes de enviar síntomas y antes de postular; registrar versión/fecha del consentimiento; revisar obligaciones legales aplicables con asesoría local.

### H-06 — Confirmación de cita habilitable sin sesión visible

Un visitante no autenticado puede seleccionar duración, horario y ambos consentimientos hasta habilitar “Confirmar cita”. La página también dice “Inicia sesión para agendar”. No se pulsó el botón final, así que falta comprobar si el servidor bloquea correctamente.

**Acción:** deshabilitar toda la edición o pedir login al primer intento; validar autorización y saldo exclusivamente en servidor; conservar de forma segura el horario elegido tras autenticación.

### H-07 — Transcripción clínica anunciada sin consentimiento específico visible

La introducción generada para el médico dice que la sesión “puede ser transcrita para incorporarla a su historial clínico”. En la reserva, el consentimiento visible cubre videoconsulta y tratamiento de datos clínicos, pero no explica de forma específica transcripción, grabación, proveedor, finalidad, conservación, acceso, revocación o eliminación.

**Impacto:** una transcripción de voces y conversación médica contiene datos de salud especialmente sensibles. Un aviso leído por el médico justo al inicio no sustituye necesariamente un consentimiento informado, verificable y previo.

**Acción:** presentar antes de reservar/entrar un consentimiento separado y versionado para transcripción o grabación; indicar si se almacena audio, solo texto o ambos; identificar proveedores/subencargados, finalidad y retención; permitir rechazar la transcripción sin impedir la videoconsulta cuando sea legalmente posible; registrar aceptación y revocación.

### H-08 — El detalle de la cita muestra el importe retenido como pagado al médico

Tras cerrar la cita #4 a los 7 segundos, el listado del paciente mostró `Pagado al médico: 1,50 US$`. Sin embargo, la billetera registró correctamente un pago de US$1,50 y un reembolso de US$1,40, mientras la cartera médica acreditó US$0,08 tras US$0,02 de comisión.

**Impacto:** el cálculo contable real es correcto, pero la etiqueta comunica un pago diez veces mayor y contradice los movimientos, lo que puede provocar reclamaciones.

**Acción:** mostrar en la cita `Retenido`, `Costo final`, `Reembolsado`, `Comisión` e `Ingreso médico` como importes separados; usar el coste liquidado, no la retención original, para la etiqueta principal.

## Hallazgos de prioridad media

### M-01 — `robots.txt` incompleto para zonas privadas

Se bloquean `/admin`, `/me/`, `/reviewer`, `/video-room` y `/notifications`, pero no aparecen rutas privadas como `/doctor/*`, `/support/*` o `/consultation/*`. Todas redirigen a login en el cliente, pero el HTML base responde 200 e indexable.

**Acción:** cubrir rutas privadas específicas y, sobre todo, devolver `noindex`/estado adecuado desde servidor. No usar robots como control de seguridad.

### M-02 — Inconsistencia de Open Graph en perfiles

El perfil del médico cambia `og:image` a una foto JPG de 480×480, pero conserva `og:image:type=image/png`, `og:image:width=1200`, `og:image:height=630` y un alt genérico de SabioDoc.

**Acción:** generar una tarjeta social 1200×630 real por médico o actualizar tipo, dimensiones y alt a los valores correctos.

### M-03 — Cabecera móvil apretada

A 390 px, “Iniciar sesión” se parte en dos líneas y compite con el logo y “Registrarse”. La tarjeta de onboarding médico también queda demasiado estrecha por mantener el icono como columna lateral.

**Acción:** menú compacto/hamburguesa por debajo de ~640 px, o reducir acciones; apilar icono y contenido de onboarding.

### M-04 — Contraste insuficiente

Comprobación aproximada sobre colores calculados:

- CTA verde `#059669` con texto blanco: ~3,77:1 para 16 px, por debajo de 4,5:1.
- aviso amarillo del pie: ~3,07:1 a 12 px.
- subtítulo rojo de emergencia: ~4,41:1 a 16 px.

**Acción:** oscurecer fondos/colores y verificar WCAG 2.2 AA con una herramienta automatizada.

### M-05 — Errores de formulario no reciben foco

En login, registro y triaje, el mensaje aparece con `role=alert` y `aria-invalid`, lo cual es positivo; pero el foco permanece en el botón submit, no pasa al primer campo inválido. En la postulación médica se muestra solo “Completa los campos obligatorios”, sin mensajes por campo.

**Acción:** mover el foco al primer error, asociar cada mensaje mediante `aria-describedby` y ofrecer un resumen de errores.

### M-06 — Horario seleccionado solo se comunica por color

Al elegir `07:00`, el botón cambia de clase/color, pero no expone `aria-pressed`, `aria-selected` ni `data-state`.

**Acción:** modelar los horarios como radios o botones `aria-pressed`; anunciar fecha, hora y zona horaria.

### M-07 — Caché demasiado corta para assets versionados

JS, CSS e imágenes con hash usan `Cache-Control: public, max-age=0, s-maxage=300`. El navegador revalida en lugar de conservar assets inmutables.

**Acción:** `public, max-age=31536000, immutable` para archivos con hash; mantener HTML con caché corta.

### M-08 — Cabeceras de seguridad incompletas

Positivo: HSTS largo y `X-Content-Type-Options: nosniff`; CORS de API restringido al frontend.

Ausentes en frontend/API: CSP, `Referrer-Policy`, `Permissions-Policy`, protección de framing (`frame-ancestors` o X-Frame-Options), COOP/CORP donde aplique.

**Acción:** definir una CSP compatible con videollamada y Cloudinary; añadir políticas progresivamente con reporte primero.

### M-09 — Localización inconsistente en onboarding

Países y ciudades aparecen en inglés (`Peru`, `United States`, etc.); la zona horaria muestra identificadores IANA crudos; la lista de ciudades es muy larga y contiene nombres poco útiles para el caso de uso.

**Acción:** localizar etiquetas, usar búsqueda/autocompletado, priorizar Perú y mostrar la zona como “Lima (UTC−5)”.

### M-10 — Estado transitorio engañoso en búsqueda

Durante la espera del filtro (~1–2 s observados), la vista muestra “Resultados (0) / Sin resultados” antes de presentar coincidencias.

**Acción:** mostrar spinner/skeleton o conservar resultados anteriores durante debounce/carga.

### M-11 — Contadores y listas del panel médico se contradicen

El panel mostró `CITAS PROGRAMADAS 1`, pero simultáneamente “No tienes citas próximas”. La lista de citas sí contenía la reserva de las 14:15. Tras preparar la sala, el bloque de sesiones cambió a `Preparada`, lo que confirma que el registro existía.

En un nuevo intento, la sala mostró al paciente como `En la sala 14:24`, pero al mismo tiempo indicó `El cronómetro está en pausa: falta el paciente en la sala`, mantuvo `Iniciar consulta` deshabilitado y describió como ayuda `El paciente debe estar en la sala`. El estado de presencia y la regla que habilita la consulta no usan la misma fuente de verdad.

Se repitió la prueba después de cerrar explícitamente la sesión del médico, iniciar y cerrar la del paciente, recargar la portada en estado anónimo y volver a iniciar como médico. La sala conservó `Conectado 14:18` y `En la sala 14:24`; por tanto, no era memoria local de una pestaña sino presencia obsoleta persistida o no invalidada en servidor. El fallo de carga de Jitsi que acompañó esa prueba fue corregido posteriormente, pero la inconsistencia de presencia continúa visible en la reprueba.

**Acción:** usar una misma definición temporal y zona horaria para contadores y listas; unificar presencia WebSocket/Jitsi y habilitación del cronómetro en una máquina de estados del servidor; distinguir cita próxima, cita dentro de ventana de acceso y sesión preparada; añadir pruebas alrededor de los límites de horario y reconexiones.

### M-12 — Stream de notificaciones solicita una URL mal formada

Durante la recarga de la sala se observó una solicitud a `https://sabiodoc.onrender.com//notifications/stream` que respondió `404`. La doble barra entre dominio y ruta sugiere una concatenación incorrecta de la URL base.

**Impacto:** pérdida o retraso de actualizaciones en tiempo real, reintentos innecesarios y posible contribución a los estados de presencia contradictorios.

**Acción:** normalizar la URL base sin barra final o resolver rutas con un constructor de URL; añadir una prueba de integración que compruebe la conexión SSE/WebSocket y la actualización de presencia.

## Hallazgos menores y de contenido

- Faltan tildes en varios textos: `medicos`, `Medico no encontrado`, `Peru`.
- El dominio `onrender.com` reduce confianza y marca; conviene dominio propio con canonical definitivo.
- Varios enlaces de texto en móvil tienen altura visual cercana a 20–21 px; revisar tamaños/espaciado táctil.
- `manifest.webmanifest` responde como `application/octet-stream`, no `application/manifest+json`.
- El pie repite el disclaimer en todas las páginas, pero su contraste y tamaño reducen su eficacia.
- No hay datos estructurados en la portada; convendría `Organization`, `WebSite` y, donde corresponda, `MedicalWebPage`/`FAQPage`.

## Aspectos que funcionan bien

- Diseño de escritorio profesional, buena jerarquía, paleta coherente y CTAs claros.
- Sin desbordamiento horizontal en las 12 plantillas verificadas a 390 px.
- Navegación principal, modal de orientación, tabs, FAQ, filtros y búsquedas básicas funcionan.
- Las rutas privadas probadas redirigen correctamente a `/login` sin sesión.
- `html lang="es"`, enlace “Saltar al contenido”, landmarks, títulos, alt de imágenes, labels y autocomplete están bien trabajados.
- Dialog, tabs, radios y barra de progreso exponen roles accesibles.
- Los errores de formularios usan `role=alert` y `aria-invalid`.
- HSTS y `nosniff` presentes; CORS de API limitado al origen del frontend.
- `robots.txt` y sitemap existen; las 36 fichas de especialidad responden en API.
- No se observaron errores de consola durante el recorrido público.
- Tiempos observados en una ejecución repetida: FCP ~104 ms en portada y ~388–404 ms en vistas con datos; API de especialidades ~425–508 ms y perfil médico ~939 ms. No son Core Web Vitals de campo.

## SEO: plan recomendado

1. Implementar SSR/prerender para portada, Cómo funciona, especialidades y médicos.
2. Devolver 404 real y `noindex` en recursos inexistentes.
3. Retirar datos de prueba y regenerar sitemap.
4. Servir canonical/OG/Twitter/JSON-LD desde HTML inicial.
5. Añadir `Organization`, `WebSite`, `BreadcrumbList`, `Physician`, `MedicalSpecialty` y `FAQPage` donde aplique.
6. Marcar login, registro, recuperación, verificación y rutas privadas como `noindex`.
7. Corregir OG de perfiles y usar dominio propio.
8. Añadir Search Console/Bing Webmaster y medir cobertura, soft 404 y CWV.

## Diseño y UX: plan recomendado

1. Corregir cabecera móvil y tarjeta de onboarding.
2. Separar búsqueda por nombre de orientación por síntomas.
3. Añadir estados de carga reales en búsqueda y guía IA.
4. Mantener historial estable al avanzar/retroceder en la guía.
5. Simplificar país/ciudad/zona horaria y localizar todo al español.
6. Revisar contraste, foco, estados seleccionados y tamaño táctil.
7. Añadir páginas visibles de privacidad, términos, telemedicina, soporte y contacto.

## Pruebas autenticadas realizadas y pendientes

| Rol/flujo | Resultado |
|---|---|
| Administrador — crear paciente | Correcto; el total de usuarios aumentó y la cuenta apareció en el listado |
| Paciente — inicio de sesión | Correcto; redirección a `/me/profile` |
| Paciente — recarga ficticia | Correcto; saldo US$5,00 y movimiento visible |
| Paciente — reservar cita | Correcto; primera franja disponible, consentimientos, US$1,50 retenidos |
| Paciente — listado de citas | Correcto; estado Programada y botón de entrada visible |
| Médico — panel y citas | Correcto; la cita aparece con el paciente sintético |
| Médico — preparar sala | Correcto; la cita nueva aparece y ambos roles reciben el mismo identificador de sala |
| Paciente y médico — video Jitsi | Fallo crítico; ambos quedan esperando moderador y no se unen, aunque SabioDoc indica Ambos conectados |
| Cámara y micrófono | Fallo; no se obtuvo acceso en el navegador de prueba |
| Cronómetro y cobro por minuto | Correcto técnicamente: 7 s, US$0,10, reembolso US$1,40, médico US$0,08, comisión US$0,02 |
| Cierre de consulta | Correcto; estado Completada y sala deshabilitada |

Todavía hacen falta cuentas o datos de prueba para cerrar médico pendiente, revisor y soporte, además de un buzón controlado para verificación/recuperación. Para aprobar/rechazar, reprogramar/cancelar, enviar mensajes o archivos y ejecutar retiros deben seguir usándose datos completamente sintéticos.

## Orden de remediación sugerido

### Antes de lanzar o promocionar

1. Emergencias y búsqueda por síntomas.
2. Eliminar `Dr. Test` y otros datos seed.
3. Privacidad, términos y consentimientos.
4. Soft 404 y metadatos SSR.
5. Moderación/autenticación Jitsi y bloqueo del cobro hasta confirmar dos participantes reales.

### Siguiente iteración

6. Historial estable de guía IA.
7. Cabecera móvil, contraste y foco de errores.
8. Robots/noindex y datos estructurados.
9. Cabeceras de seguridad y caché.
10. Localización y pulido de copy.

## Limitaciones de esta fase

- Se usaron las cuentas de demostración suministradas y un paciente QA creado para esta auditoría; no se usaron datos clínicos reales.
- La creación del usuario, la recarga y la reserva sí se ejecutaron. No se reprogramó ni canceló la cita, no se enviaron notas, mensajes o archivos y no se solicitaron retiros.
- En la reprueba, ambos roles cargaron la misma sala de `meet.jit.si`, pero Jitsi los dejó esperando moderador y nunca mostró dos participantes unidos. No se concedieron permisos de cámara/micrófono; por ello no fue posible validar audio/video real ni transcripción.
- El cronómetro, cierre y liquidación sí se validaron con dinero ficticio: 7 segundos, coste US$0,10 y reembolso US$1,40.
- Las mediciones de rendimiento son observaciones puntuales del navegador, no datos de usuarios reales ni una corrida oficial de Lighthouse.
