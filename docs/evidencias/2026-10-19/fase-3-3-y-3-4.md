# Fase 3.3–3.4 — Vigencia del prerender, sitemap y noindex

**Fecha:** 19/10/2026

## 3.3 Vigencia del prerender

- El build sigue generando HTML por especialidad y médico aprobado.
- Nueva variable `FRONTEND_DEPLOY_HOOK_URL` para el deploy hook de Render.
- La API dispara un rebuild cuando:
  - se aprueba, rechaza o suspende un médico;
  - un médico aprobado actualiza su perfil;
  - un médico aprobado cambia o elimina su foto.
- Si el hook no está configurado, la operación continúa y queda registrado en logs.
- Los médicos nuevos requieren rebuild; con el hook se hace automáticamente.

### Open Graph de perfiles

Se mantiene el tratamiento por médico:

- `og:image` usa la foto real si existe.
- `og:image:type` se deriva de la URL.
- No se declaran dimensiones genéricas cuando la imagen es la foto del médico.
- `og:image:alt` usa el nombre del médico.

## 3.4 Sitemap, robots y noindex

- `sitemap.xml` estático limpio: solo rutas públicas, con barra final.
- Se quitaron `/login/` y `/register/` del sitemap estático.
- Se añadieron telemedicina, privacidad y términos.
- El sitemap generado en build solo incluye rutas públicas, especialidades y médicos.
- `robots.txt` mantiene bloqueadas las rutas privadas.
- `AuthenticatedRoute` marca todas las rutas autenticadas como `noindex, nofollow`.
- Login, registro, recuperación, reset y verificación también se marcan `noindex`.
- `render-config.md` incluye `X-Robots-Tag: noindex, nofollow` para rutas privadas.

**Pendiente externo:** configurar Search Console y Bing Webmaster para medir cobertura y soft 404.

## Verificación

```text
Frontend: 29 archivos, 113 tests OK
Backend:  162 tests OK
Lint:     OK
TypeScript: OK
Build:    OK
Sitemap:  48 URLs
```
