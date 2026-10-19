# Configuración de Render — frontend SabioDoc

**Fecha:** 19/10/2026  
**Servicio:** frontend estático (`sabiodoc-1.onrender.com`)  
**Objetivo:** que Render sirva los HTML prerenderizados, aplique 404 real, cabeceras, redirects, MIME y caché.

> Estas acciones se hacen en el dashboard de Render. El repositorio contiene `_headers`, `_redirects` y `404.html`, pero la verificación del 19/10 demuestra que el servicio no aplica `_headers` ni los HTML sin barra. En Render, la fuente de verdad para redirects/rewrites y cabeceras es el dashboard, no esos archivos (que quedan como referencia para otros hostings).

## 1. Configuración del servicio

| Campo | Valor |
|---|---|
| Tipo | Static Site |
| Root Directory | `apps/web` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Auto-Deploy | Rama que corresponda (`main`/`master`) |

Variables de entorno de build:

```text
VITE_API_URL=https://sabiodoc.onrender.com
VITE_SITE_URL=https://sabiodoc-1.onrender.com
```

Si se usa un dominio definitivo, cambiar `VITE_SITE_URL` antes del build y volver a desplegar. El canonical y el sitemap se generan con ese valor.

## 2. Eliminar el catch-all

En **Redirects/Rewrites** del servicio estático:

- Eliminar cualquier regla `/*` → `/index.html` con acción **Rewrite**.
- No dejar un catch-all que devuelva 200 para rutas inexistentes.

Sin ese cambio, `/ruta-inexistente`, `/specialties/slug-inexistente` y `/doctors/999999` seguirán respondiendo 200, y las páginas prerenderizadas sin barra final seguirán sirviendo el HTML de la portada.

## 3. Redirects y rewrites en el dashboard

En Render no hay un campo para escribir `301`. El selector **Action** ya define el código:

- **Redirect** = respuesta **301 Moved Permanently**. Se usa para mandar la URL sin barra a la URL con barra.
- **Rewrite** = sirve otro contenido manteniendo la URL, normalmente **200**. Se usa para las rutas de la SPA.

Crear estas reglas en **Redirects/Rewrites**, en este orden:

| Source | Destination | Action |
|---|---|---|
| `/como-funciona` | `/como-funciona/` | Redirect |
| `/specialties` | `/specialties/` | Redirect |
| `/triage` | `/triage/` | Redirect |
| `/guide` | `/guide/` | Redirect |
| `/emergency` | `/emergency/` | Redirect |
| `/telemedicina` | `/telemedicina/` | Redirect |
| `/privacidad` | `/privacidad/` | Redirect |
| `/terminos` | `/terminos/` | Redirect |
| `/doctor/apply` | `/doctor/apply/` | Redirect |
| `/specialties/:slug` | `/specialties/:slug/index.html` | **Rewrite** |
| `/doctors/:id` | `/doctors/:id/index.html` | **Rewrite** |
| `/login` | `/index.html` | Rewrite |
| `/register` | `/index.html` | Rewrite |
| `/forgot-password` | `/index.html` | Rewrite |
| `/reset-password` | `/index.html` | Rewrite |
| `/verify-email` | `/index.html` | Rewrite |
| `/notifications` | `/index.html` | Rewrite |
| `/help` | `/index.html` | Rewrite |
| `/video-room` | `/index.html` | Rewrite |
| `/me/*` | `/index.html` | Rewrite |
| `/consultation/*` | `/index.html` | Rewrite |
| `/doctor/*` | `/index.html` | Rewrite |
| `/admin/*` | `/index.html` | Rewrite |
| `/reviewer/*` | `/index.html` | Rewrite |
| `/support/*` | `/index.html` | Rewrite |
| `/doctors/*` | `/index.html` | Rewrite |

Notas:

- Render soporta placeholders `:slug`/`:id` y wildcards `*`; no hace falta una regla por especialidad o médico.
- **Importante:** las rutas dinámicas van como **Rewrite**, no como Redirect. Un Redirect `/specialties/:slug` → `/specialties/:slug/` entra en bucle cuando el slug no existe, porque la regla vuelve a coincidir con la barra final. Con Rewrite se sirve el `index.html` si existe y se evita el bucle.
- Render **no aplica** una regla si ya existe un recurso en esa ruta. Por eso los HTML prerenderizados con barra final ganan sin problema.
- No eliminar `/doctors/*` hasta decidir la estrategia de 404 para médicos nuevos (decisión D2 del plan).
- El archivo `apps/web/public/_redirects` sigue siendo la referencia para otros hostings, pero en Render hay que replicar estas reglas en el dashboard.

## 4. Cabeceras

Estas cabeceras **no van en Redirects/Rewrites**. Van en la sección **Headers** del servicio estático. Cada fila tiene tres campos: **Path**, **Name** y **Value**.

No son solo tres: son **7 cabeceras globales + 3 específicas**. Hay que agregarlas una por una.

### 4.1 Globales (Path `/*`)

| Path | Name | Value |
|---|---|---|
| `/*` | `X-Content-Type-Options` | `nosniff` |
| `/*` | `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `/*` | `X-Frame-Options` | `DENY` |
| `/*` | `Permissions-Policy` | `camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), geolocation=(self), display-capture=(self "https://meet.jit.si")` |
| `/*` | `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` |
| `/*` | `Content-Security-Policy-Report-Only` | `default-src 'self'; script-src 'self' 'unsafe-inline' https://meet.jit.si https://*.jitsi.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com; media-src 'self' blob: https://res.cloudinary.com https://*.cloudinary.com; connect-src 'self' https: wss:; frame-src https://meet.jit.si; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| `/*` | `Cache-Control` | `public, max-age=0, must-revalidate` |

### 4.2 Específicas

| Path | Name | Value |
|---|---|---|
| `/assets/*` | `Cache-Control` | `public, max-age=31536000, immutable` |
| `/manifest.webmanifest` | `Content-Type` | `application/manifest+json` |
| `/og-image.png` | `Cache-Control` | `public, max-age=86400` |

Notas:

- La CSP está en `Report-Only` a propósito hasta cerrar la Fase 4. No pasarla a bloqueo sin revisar los reportes de Jitsi y Cloudinary.
- Si Render duplica `Cache-Control` entre `/*` y `/assets/*`, elimina la fila global de `Cache-Control`; el HTML ya se sirve con `max-age=0` por defecto.
- `Content-Type` para el manifest es necesario porque hoy Render lo sirve como `binary/octet-stream`.

## 5. Página 404

- Confirmar que el servicio tiene `404.html` como página de error.
- El archivo ya existe en `apps/web/public/404.html`.
- Debe responder con HTTP 404, no 200.

## 6. Redesplegar y verificar

1. Guardar los cambios y lanzar **Manual Deploy → Clear build cache & deploy**.
2. Esperar a que termine el deploy.
3. Ejecutar desde `apps/web`:

```bash
SITE_URL=https://sabiodoc-1.onrender.com API_URL=https://sabiodoc.onrender.com npm run verify:prod
```

4. Revisar `docs/evidencias/AAAA-MM-DD/verificacion-produccion.md`.

## 7. Criterios de cierre de 0.1

- [ ] `/como-funciona` redirige 301 a `/como-funciona/`.
- [ ] `/como-funciona/` devuelve título, canonical y OG con barra final.
- [ ] `/specialties/cardiologia/` devuelve su propio título.
- [ ] `/ruta-inexistente` responde 404.
- [ ] `manifest.webmanifest` responde `application/manifest+json`.
- [ ] `/assets/*` responde `max-age=31536000, immutable`.
- [ ] Las cabeceras de seguridad aparecen en `curl -I`.
- [ ] El sitemap solo publica URLs con barra final.
