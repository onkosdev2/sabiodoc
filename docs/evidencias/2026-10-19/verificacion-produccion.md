# Verificación de producción — SabioDoc

- **Sitio:** https://sabiodoc-1.onrender.com
- **API:** https://sabiodoc.onrender.com
- **Fecha:** 2026-10-19T16:02:42.825Z
- **Resultado:** 68/71 comprobaciones OK
- **Fallos críticos:** 3

| ID | Comprobación | Resultado | Detalle |
|---|---|---|---|
| `page:/` | / responde 200 | ✅ PASS | HTTP 200 |
| `title:/` | / tiene el título esperado | ✅ PASS | “SabioDoc - Orientación Médica Inteligente” |
| `canonical:/` | / canonical coincide con la URL servida | ✅ PASS | canonical=https://sabiodoc-1.onrender.com/ esperado=https://sabiodoc-1.onrender.com/ |
| `og:/` | / og:url coincide con la URL servida | ✅ PASS | og:url=https://sabiodoc-1.onrender.com/ esperado=https://sabiodoc-1.onrender.com/ |
| `robots:/` | / es indexable | ✅ PASS | robots=index,follow |
| `page:/como-funciona` | /como-funciona responde 301 | ✅ PASS | HTTP 301 → /como-funciona/ |
| `page:/como-funciona/` | /como-funciona/ responde 200 | ✅ PASS | HTTP 200 |
| `title:/como-funciona/` | /como-funciona/ tiene el título esperado | ✅ PASS | “Cómo funciona SabioDoc” |
| `canonical:/como-funciona/` | /como-funciona/ canonical coincide con la URL servida | ✅ PASS | canonical=https://sabiodoc-1.onrender.com/como-funciona/ esperado=https://sabiodoc-1.onrender.com/como-funciona/ |
| `og:/como-funciona/` | /como-funciona/ og:url coincide con la URL servida | ✅ PASS | og:url=https://sabiodoc-1.onrender.com/como-funciona/ esperado=https://sabiodoc-1.onrender.com/como-funciona/ |
| `robots:/como-funciona/` | /como-funciona/ es indexable | ✅ PASS | robots=index,follow |
| `page:/specialties` | /specialties responde 301 | ✅ PASS | HTTP 301 → /specialties/ |
| `page:/specialties/` | /specialties/ responde 200 | ✅ PASS | HTTP 200 |
| `title:/specialties/` | /specialties/ tiene el título esperado | ✅ PASS | “Especialidades médicas” |
| `canonical:/specialties/` | /specialties/ canonical coincide con la URL servida | ✅ PASS | canonical=https://sabiodoc-1.onrender.com/specialties/ esperado=https://sabiodoc-1.onrender.com/specialties/ |
| `og:/specialties/` | /specialties/ og:url coincide con la URL servida | ✅ PASS | og:url=https://sabiodoc-1.onrender.com/specialties/ esperado=https://sabiodoc-1.onrender.com/specialties/ |
| `robots:/specialties/` | /specialties/ es indexable | ✅ PASS | robots=index,follow |
| `page:/specialties/cardiologia` | /specialties/cardiologia responde 200 | ✅ PASS | HTTP 200 |
| `title:/specialties/cardiologia` | /specialties/cardiologia tiene el título esperado | ✅ PASS | “Cardiología · SabioDoc” |
| `canonical:/specialties/cardiologia` | /specialties/cardiologia canonical coincide con la URL servida | ✅ PASS | canonical=https://sabiodoc-1.onrender.com/specialties/cardiologia/ esperado=https://sabiodoc-1.onrender.com/specialties/cardiologia/ |
| `og:/specialties/cardiologia` | /specialties/cardiologia og:url coincide con la URL servida | ✅ PASS | og:url=https://sabiodoc-1.onrender.com/specialties/cardiologia/ esperado=https://sabiodoc-1.onrender.com/specialties/cardiologia/ |
| `robots:/specialties/cardiologia` | /specialties/cardiologia es indexable | ✅ PASS | robots=index,follow |
| `page:/specialties/cardiologia/` | /specialties/cardiologia/ responde 200 | ✅ PASS | HTTP 200 |
| `title:/specialties/cardiologia/` | /specialties/cardiologia/ tiene el título esperado | ✅ PASS | “Cardiología · SabioDoc” |
| `canonical:/specialties/cardiologia/` | /specialties/cardiologia/ canonical coincide con la URL servida | ✅ PASS | canonical=https://sabiodoc-1.onrender.com/specialties/cardiologia/ esperado=https://sabiodoc-1.onrender.com/specialties/cardiologia/ |
| `og:/specialties/cardiologia/` | /specialties/cardiologia/ og:url coincide con la URL servida | ✅ PASS | og:url=https://sabiodoc-1.onrender.com/specialties/cardiologia/ esperado=https://sabiodoc-1.onrender.com/specialties/cardiologia/ |
| `robots:/specialties/cardiologia/` | /specialties/cardiologia/ es indexable | ✅ PASS | robots=index,follow |
| `page:/privacidad` | /privacidad responde 301 | ✅ PASS | HTTP 301 → /privacidad/ |
| `page:/privacidad/` | /privacidad/ responde 200 | ✅ PASS | HTTP 200 |
| `title:/privacidad/` | /privacidad/ tiene el título esperado | ✅ PASS | “Política de privacidad” |
| `canonical:/privacidad/` | /privacidad/ canonical coincide con la URL servida | ✅ PASS | canonical=https://sabiodoc-1.onrender.com/privacidad/ esperado=https://sabiodoc-1.onrender.com/privacidad/ |
| `og:/privacidad/` | /privacidad/ og:url coincide con la URL servida | ✅ PASS | og:url=https://sabiodoc-1.onrender.com/privacidad/ esperado=https://sabiodoc-1.onrender.com/privacidad/ |
| `robots:/privacidad/` | /privacidad/ es indexable | ✅ PASS | robots=index,follow |
| `page:/emergency` | /emergency responde 301 | ✅ PASS | HTTP 301 → /emergency/ |
| `page:/emergency/` | /emergency/ responde 200 | ✅ PASS | HTTP 200 |
| `title:/emergency/` | /emergency/ tiene el título esperado | ✅ PASS | “Emergencias” |
| `canonical:/emergency/` | /emergency/ canonical coincide con la URL servida | ✅ PASS | canonical=https://sabiodoc-1.onrender.com/emergency/ esperado=https://sabiodoc-1.onrender.com/emergency/ |
| `og:/emergency/` | /emergency/ og:url coincide con la URL servida | ✅ PASS | og:url=https://sabiodoc-1.onrender.com/emergency/ esperado=https://sabiodoc-1.onrender.com/emergency/ |
| `robots:/emergency/` | /emergency/ es indexable | ✅ PASS | robots=index,follow |
| `page:/doctor/apply` | /doctor/apply responde 301 | ✅ PASS | HTTP 301 → /doctor/apply/ |
| `page:/doctor/apply/` | /doctor/apply/ responde 200 | ✅ PASS | HTTP 200 |
| `title:/doctor/apply/` | /doctor/apply/ tiene el título esperado | ✅ PASS | “Postular como médico” |
| `canonical:/doctor/apply/` | /doctor/apply/ canonical coincide con la URL servida | ✅ PASS | canonical=https://sabiodoc-1.onrender.com/doctor/apply/ esperado=https://sabiodoc-1.onrender.com/doctor/apply/ |
| `og:/doctor/apply/` | /doctor/apply/ og:url coincide con la URL servida | ✅ PASS | og:url=https://sabiodoc-1.onrender.com/doctor/apply/ esperado=https://sabiodoc-1.onrender.com/doctor/apply/ |
| `robots:/doctor/apply/` | /doctor/apply/ es indexable | ✅ PASS | robots=index,follow |
| `404:/ruta-inexistente-auditoria` | /ruta-inexistente-auditoria devuelve 404 o noindex real | ✅ PASS | HTTP 404; robots=noindex, nofollow |
| `404:/specialties/slug-que-no-existe` | /specialties/slug-que-no-existe devuelve 404 o noindex real | ❌ FAIL | HTTP 200; robots=(vacío) |
| `404:/doctors/999999` | /doctors/999999 devuelve 404 o noindex real | ❌ FAIL | HTTP 200; robots=(vacío) |
| `header:content-security-policy` | Cabecera content-security-policy presente | ✅ PASS | default-src 'self'; script-src 'self' 'unsafe-inline' https://meet.jit.si https://*.jitsi.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com; media-src 'self' blob: https://res.cloudinary.com https://*.cloudinary.com; connect-src 'self' https: wss:; frame-src https://meet.jit.si; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none' |
| `header:referrer-policy` | Cabecera referrer-policy presente | ✅ PASS | strict-origin-when-cross-origin |
| `header:permissions-policy` | Cabecera permissions-policy presente | ✅ PASS | camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), geolocation=(self), display-capture=(self "https://meet.jit.si") |
| `header:framing` | Protección de framing presente | ✅ PASS | DENY |
| `cache:html` | HTML no se cachea como inmutable | ✅ PASS | public, max-age=0, must-revalidate |
| `cache:asset` | Assets con hash usan caché inmutable | ✅ PASS | public, max-age=31536000, immutable |
| `manifest:mime` | manifest.webmanifest se sirve como application/manifest+json | ✅ PASS | application/manifest+json |
| `sitemap` | Sitemap accesible | ✅ PASS | 48 URLs |
| `sitemap:slash` | Todas las URLs del sitemap usan la forma canónica con barra final | ✅ PASS | ok |
| `sitemap:url:/` | / responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/ |
| `sitemap:url:/como-funciona/` | /como-funciona/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/como-funciona/ |
| `sitemap:url:/specialties/` | /specialties/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/specialties/ |
| `sitemap:url:/triage/` | /triage/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/triage/ |
| `sitemap:url:/guide/` | /guide/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/guide/ |
| `sitemap:url:/emergency/` | /emergency/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/emergency/ |
| `sitemap:url:/telemedicina/` | /telemedicina/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/telemedicina/ |
| `sitemap:url:/privacidad/` | /privacidad/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/privacidad/ |
| `sitemap:url:/terminos/` | /terminos/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/terminos/ |
| `sitemap:url:/doctor/apply/` | /doctor/apply/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/doctor/apply/ |
| `sitemap:url:/specialties/anatomia-patologica/` | /specialties/anatomia-patologica/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/specialties/anatomia-patologica/ |
| `sitemap:url:/specialties/anestesiologia/` | /specialties/anestesiologia/ responde 200 y canonical coincide | ✅ PASS | HTTP 200; canonical=https://sabiodoc-1.onrender.com/specialties/anestesiologia/ |
| `api:specialties` | API de especialidades responde | ✅ PASS | HTTP 200 |
| `data:test-doctors` | No hay médicos de prueba publicados en Cardiología | ❌ FAIL | 2:Dr. Test |

## Fallos críticos

- **404:/specialties/slug-que-no-existe:** /specialties/slug-que-no-existe devuelve 404 o noindex real — HTTP 200; robots=(vacío)
- **404:/doctors/999999:** /doctors/999999 devuelve 404 o noindex real — HTTP 200; robots=(vacío)
- **data:test-doctors:** No hay médicos de prueba publicados en Cardiología — 2:Dr. Test
