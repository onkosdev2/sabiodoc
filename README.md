# SabioDoc MVP

Sistema de orientación médica inteligente que ayuda a los usuarios a encontrar la especialidad médica adecuada mediante búsqueda, triage con IA, o un wizard guiado.

## 🏗️ Arquitectura

```
sabiodoc/
├── apps/
│   ├── api/          # Backend FastAPI + Python
│   └── web/          # Frontend React + Vite + TypeScript
├── docker-compose.yml
└── README.md
```

## 🚀 Requisitos Previos

- **Docker Desktop** (para Windows) o Docker + Docker Compose
- **Python 3.11+**
- **Node.js 18+** y npm
- **PowerShell** (Windows) o terminal compatible

## 📦 Instalación y Ejecución

### Paso 1: Clonar y configurar variables de entorno

```powershell
# Backend
cd apps/api
copy .env.example .env
# Editar .env con tu DEEPSEEK_API_KEY (opcional para modo mock)

# Frontend
cd ../web
copy .env.example .env
```

### Paso 2: Levantar base de datos con Docker

```powershell
# Desde la raíz del proyecto
docker compose up -d
```

Esto levanta:
- **PostgreSQL** en `localhost:5432`
- **pgAdmin** en `http://localhost:5050` (usuario: admin@sabiodoc.com / admin123)

### Paso 3: Configurar y ejecutar Backend

```powershell
cd apps/api

# Crear entorno virtual
python -m venv venv
.\venv\Scripts\Activate.ps1 (linux: source venv/bin/activate)

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar migraciones
alembic upgrade head

# Sembrar especialidades
python -m app.seed.run_seed

# Iniciar servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El backend estará en: `http://localhost:8000`
Documentación API: `http://localhost:8000/docs`

### Paso 4: Ejecutar Frontend

```powershell
cd apps/web

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará en: `http://localhost:5173`

> Los listados de ciudades (`apps/web/public/cities/`) se generan automáticamente
> al ejecutar `npm run dev` o `npm run build` (script `npm run generate:cities`)
> y están ignorados por git. Si faltan, ejecuta ese script manualmente.

> La PWA se activa solo en el build de producción: `npm run build` genera `dist/sw.js`
> (service worker con precache del shell) y lo registra `src/components/ServiceWorkerUpdater.tsx`,
> que además muestra un aviso de "nueva versión disponible". La navegación es network-first, así
> que nunca se sirve una app vieja estando en línea.

## 🔑 Variables de Entorno

### Backend (`apps/api/.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| DATABASE_URL | Conexión PostgreSQL | postgresql://sabiodoc:sabiodoc_secret@localhost:5432/sabiodoc_db |
| JWT_SECRET | Clave secreta para tokens | tu-clave-secreta-muy-larga |
| JWT_ALGORITHM | Algoritmo JWT | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | Expiración token | 60 |
| DEEPSEEK_API_KEY | API Key de DeepSeek | sk-xxx (opcional) |
| DEEPSEEK_BASE_URL | URL base API | https://api.deepseek.com |
| DEEPSEEK_MODEL | Modelo a usar | deepseek-chat |
| FRONTEND_ORIGIN | URL del frontend | http://localhost:5173 |

### Frontend (`apps/web/.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| VITE_API_URL | URL del backend | http://localhost:8000 |
| VITE_SITE_URL | URL pública del sitio (canonical, Open Graph, robots.txt y sitemap.xml). Si no se define, se usa `https://sabiodoc.app` | https://sabiodoc.app |

## 💳 Créditos y pagos (dinero de prueba)

SabioDoc usa un monedero de **créditos** donde **1 crédito = 1 USD = 100 centavos**.
Mientras no se integre una pasarela real, las recargas y retiros usan dinero ficticio.

Flujo de una cita:

1. El paciente **recarga créditos** (`POST /wallet/topup`).
2. Al **agendar** una cita se **retiene** el monto del tiempo reservado (`duration × precio/min`, `status = held`).
3. Antes de agendar, el paciente acepta que la consulta puede extenderse y consumir créditos extra.
4. Durante la videoconsulta, el **cronómetro solo corre cuando el paciente y el médico están en la sala**. Si uno sale o deja de dar señal, se **pausa** y solo se acumula el tiempo con ambos presentes.
5. **5 minutos antes** del fin del tiempo reservado se muestra un aviso sobre el tiempo extra.
6. Si la consulta se **extiende**, se **consumen créditos del saldo** del paciente minuto a minuto (con aviso en vivo). Si el saldo se agota, la **videollamada finaliza automáticamente** (`closed_reason = completed_no_credits`).
7. Al **completar** (o al expirar/cortar), se liquida el **tiempo real**: el tiempo reservado sale de la retención, el tiempo extra del saldo; lo no usado se **devuelve al paciente** y el médico recibe su parte.
8. Si la cita se **cancela**, se **reembolsa** todo al paciente (`refunded`).
9. Paciente y médico pueden **solicitar retiros**. Se procesan **automáticamente** con la pasarela de payouts (mock en pruebas, Stripe Connect en producción): el retiro pasa a `processing` y se confirma por webhook (`paid` o `failed`). Si falla, los créditos se devuelven solos; el admin solo monitorea.

### Comisión de la plataforma

SabioDoc cobra una **comisión del 20%** (`PLATFORM_FEE_BPS=2000`) sobre lo que cobra el médico. Al liquidar la cita, el monto facturado se reparte así:

- **Bruto**: lo que paga el paciente por el tiempo real (`billable_amount_cents`).
- **Comisión 20%**: ingreso de la plataforma (`platform_fee_cents`).
- **Neto 80%**: lo que se acredita al monedero del médico (`doctor_amount_cents`).

La comisión es configurable con `PLATFORM_FEE_BPS` (100 = 1%). El médico ve el desglose en su onboarding (tarifa neta), su monedero («Mis ingresos»), el panel operativo y la sala de videoconsulta. El admin lo ve en **Ingresos y salidas** (`/admin/finance`), con el detalle por cita liquidada.

El panel de la videoconsulta muestra el **costo real de la sesión**, el máximo retenido, el tiempo extra consumido, el saldo disponible y si el cronómetro está activo o en pausa por ausencia de alguno.

Variables de entorno (backend):

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| CREDITS_CURRENCY | Moneda del monedero | usd |
| WALLET_MIN_TOPUP_CENTS | Recarga mínima (centavos) | 500 |
| WALLET_MAX_TOPUP_CENTS | Recarga máxima (centavos) | 100000 |
| WALLET_MIN_WITHDRAWAL_CENTS | Retiro mínimo (centavos) | 1000 |
| PLATFORM_FEE_BPS | Comisión de plataforma (puntos básicos) | 2000 |
| PAYOUT_PROVIDER | Pasarela de retiros (`mock`/`stripe`) | mock |
| VIDEO_PRESENCE_TIMEOUT_SECONDS | Segundos sin señal antes de pausar el cronómetro | 30 |
| VIDEO_MIN_BILLABLE_MINUTES | Mínimo facturable si hubo sesión activa | 1 |

## 📋 Endpoints API

### Seguridad de contraseñas
- Política mínima: **8 caracteres**, al menos una letra y un número (validada en registro, reset y cambio).
- Cambio de contraseña: `POST /auth/change-password` pide la contraseña actual, **revoca las demás sesiones** (`session_version`), cancela los enlaces de restablecimiento pendientes, registra el evento en auditoría y **envía un correo de confirmación**. Devuelve un token nuevo para no cerrar la sesión actual.
- En la app, cada usuario lo encuentra en **Perfil → Seguridad** (`/me/security`, `/doctor/security`, `/admin/security`, `/reviewer/security`, `/support/security`).

### Autenticación
- `POST /auth/register` - Registro de usuario
- `POST /auth/login` - Inicio de sesión
- `GET /auth/me` - Usuario actual
- `POST /auth/forgot-password` - Solicitar enlace de restablecimiento
- `POST /auth/reset-password` - Restablecer con token (correo)
- `POST /auth/change-password` - Cambiar contraseña (sesión activa; exige la actual)

### Roles y permisos
Los roles son **múltiples** por usuario (tabla `user_roles`). `patient` es el rol base que
**toda cuenta** tiene; `doctor`, `reviewer`, `admin` y `support` son roles sumables. La capacidad clínica
(tarifa, aprobación, especialidades) sigue viviendo en `DoctorProfile`.

- `POST /admin/users` / `PATCH /admin/users/{id}` aceptan `roles: ["patient", "support", ...]`.
- El rol `doctor` requiere un `DoctorProfile` (se obtiene por la postulación médica).
- `GET /admin/reviewers` y `POST/DELETE /admin/reviewers/{id}` gestionan el rol `reviewer`.
- El rol `support` puede **listar usuarios** (`GET /admin/users`) y ver la **vista de soporte**
  (`GET /admin/users/{id}/support`), pero **no** puede crear, editar ni eliminar usuarios, ni acceder
  a finanzas, errores o moderación.
- El filtro `GET /admin/users?role=patient` lista cuentas **solo paciente** (sin rol profesional);
  los demás roles filtran por pertenencia (incluye combinaciones).

### Soporte de usuario (admin)
- `GET /admin/users/{id}/support` devuelve una **vista 360°** para dar soporte: roles y estado de la
  cuenta, **cita actual/próxima y con qué médico o paciente**, videoconsultas (estado, sala, tiempos y
  facturación), consultas de IA, monedero, retiros, **errores recientes** y notificaciones.
- En el panel de administrador, cada usuario tiene la acción **«Ver información»** en el menú de tres puntos
  (abre `/admin/users/{id}/support`), con un botón para **copiar el resumen** para el ticket. En el panel de
  soporte, la lista de usuarios abre el detalle con un clic.

### Tickets de soporte
Sistema de tickets con conversación y adjuntos, para que pacientes y médicos reporten problemas
(más allá de la vista de admin). El contenido del FAQ es fijo en el frontend.

- `POST /support/tickets` - Crear ticket (paciente/médico). Adjunta contexto: rol, URL, navegador,
  último error y cita/sesión. Sugiere prioridad según la categoría.
- `GET /support/tickets` - Mis tickets · `GET /support/tickets/{id}` - Detalle (dueño o soporte/admin)
- `POST /support/tickets/{id}/messages` - Responder (usuario o soporte)
- `POST /support/attachments` - Subir adjunto (imagen/PDF) a Cloudinary y obtener su id
- `GET /support/inbox` - (Soporte/admin) Bandeja con filtros · `PATCH /support/inbox/{id}` - Estado/prioridad/asignación
- Pantallas: **Ayuda y soporte** (`/help`, con FAQ + formulario + mis tickets) y **Tickets** (`/support/tickets`).
- Notificaciones **in-app** al crear, responder y resolver.

### Especialidades
- `GET /specialties` - Listar/buscar especialidades
- `GET /specialties/top` - Especialidades destacadas
- `GET /specialties/{slug}` - Detalle de especialidad

### Triage IA
- `POST /ai/triage` - Análisis de síntomas con IA

### Guía (Wizard)
- `POST /guide/recommend` - Recomendación basada en wizard

### Consultas
- `POST /consultations` - Crear consulta
- `GET /consultations/my` - Mis consultas

### Créditos / pagos (dinero de prueba)
- `GET /wallet/me` - Saldo y movimientos del monedero
- `GET /wallet/me/transactions` - Movimientos paginados
- `POST /wallet/topup` - Recargar créditos (dinero ficticio)
- `POST /wallet/withdraw` - Solicitar retiro de créditos a una cuenta
- `GET /wallet/me/withdrawals` - Mis solicitudes de retiro
- `GET /finance/policy` - Comisión vigente y límites de tarifa (para el médico)
- `GET /admin/withdrawals` - (Admin) Historial de retiros (solo lectura)
- `GET /admin/finance/overview` - (Admin) Ingresos, salidas, comisión y custodia
- `GET /admin/finance/transactions` - (Admin) Todos los movimientos (entradas/salidas)
- `GET /admin/finance/commissions` - (Admin) Ganancias por comisión por cita
- `POST /webhooks/payouts/{provider}` - Webhook de la pasarela de payouts

### Favoritos
- `POST /favorites` - Agregar/quitar favorito
- `GET /favorites/my` - Mis favoritos

## 🩺 Especialidades Incluidas (Seed)

1. Medicina Interna
2. Cardiología
3. Neurología
4. Pediatría
5. Ginecología
6. Traumatología
7. Dermatología
8. Oftalmología
9. Otorrinolaringología
10. Psiquiatría
11. Gastroenterología
12. Endocrinología
13. Urología
14. Nefrología
15. Oncología

## ⚠️ Modo Mock (Sin API Key)

Si no configuras `DEEPSEEK_API_KEY`, el sistema funciona en **modo mock**:
- El triage devuelve respuestas genéricas
- Permite probar toda la funcionalidad sin costo

## 🔒 Notas de Seguridad Clínica

- **SabioDoc NO diagnostica ni prescribe medicamentos**
- Solo orienta hacia la especialidad médica adecuada
- Siempre muestra disclaimers de seguridad
- Detecta señales de emergencia y redirige apropiadamente
- Los mensajes incluyen: "Esto no reemplaza una consulta médica"

## 🧪 Tests

### Backend

```powershell
cd apps/api
pytest app/tests/ -v
```

> Los tests usan una **base de datos dedicada** (`<tu_bd>_test`, p. ej.
> `sabiodoc_db_test`) que `conftest.py` crea, migra y siembra automáticamente.
> Así nunca tocan tu BD de desarrollo. Para usar otra BD, exporta
> `TEST_DATABASE_URL`.

### Frontend

```powershell
cd apps/web
npm test          # ejecuta Vitest una vez (CI)
npm run test:watch  # modo interactivo
```

## Tests de videoconferencia

Uso                                                                           
 ```bash                                                                     
   cd apps/api                                                                                                                                                                        
   ./venv/bin/python scripts/create_test_appointment.py         
 ```                    

 Opciones                                                                      
 ```bash                                                                     
   # agendarla exactamente para ahora (sin desfase)                             
   ./venv/bin/python scripts/create_test_appointment.py --minutes-ago 0                                                                          
   
   # otro paciente / otro médico                                               
   ./venv/bin/python scripts/create_test_appointment.py \                      
     --patient paciente.demo@sabiodoc.app --doctor cardio.demo@sabiodoc.app                                                                                                                                                                       
   # duración distinta                                                          
   ./venv/bin/python scripts/create_test_appointment.py --duration 45                                                                                                                                                                                  
   # especialidad específica (si el médico tiene varias)                     
   ./venv/bin/python scripts/create_test_appointment.py --specialty cardiologia
                                                                      
   # Borra las citas de prueba previas y crea una nueva                       
   ./venv/bin/python scripts/create_test_appointment.py --clean                                                                                                                                                                           
   # Solo borra las citas de prueba previas (no crea nada)                     
   ./venv/bin/python scripts/create_test_appointment.py --clean-only           
 ```            

  ┌─────────────────────────────────────────────────────────────────────────────────────┬──────────────────┬──────────────────┐                                                        
 │ Email                                                                               │ Contraseña       │ Rol              │                                                        
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────┼──────────────────┤                                                        
 │ admin.demo@sabiodoc.app                                                             │ AdminDemo123!    │ admin            │                                                        
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────┼──────────────────┤                                                        
 │ paciente.demo@sabiodoc.app                                                          │ PatientDemo123!  │ patient          │                                                        
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────┼──────────────────┤                                                        
 │ revisor.demo@sabiodoc.app                                                           │ ReviewerDemo123! │ reviewer         │                                                        
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────┼──────────────────┤                                                        
 │ medico.revisor.demo@sabiodoc.app                                                    │ MedRevDemo123!   │ doctor + revisor │                                                        
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────┼──────────────────┤                                                        
 │ cardio.demo@sabiodoc.app, derma.demo@sabiodoc.app, neuro.demo@sabiodoc.app, dummy.* │ DemoDoctor123!   │ doctor           │                                                        
 └─────────────────────────────────────────────────────────────────────────────────────┴──────────────────┴──────────────────┘                                                                                     

## 🚀 Despliegue (Render)

Dos servicios:

- **API** (Web Service Python): Root Directory `apps/api`, Build `pip install -r requirements.txt`,
  **Pre-Deploy** `alembic upgrade head`, Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Frontend** (Static Site): Root Directory `apps/web`, Build `npm ci && npm run build`, Publish `dist`.

> **Imprescindible:** ejecutar `alembic upgrade head` en cada despliegue (hay migraciones nuevas).
> Si el servicio no arranca con la BD al día, fallará.

Variables clave:

- API: `DATABASE_URL`, `ENVIRONMENT=production`, `JWT_SECRET` (≥32), `FRONTEND_ORIGIN` (dominio del frontend),
  `JITSI_BASE_URL` (Jitsi self-hosted), `JITSI_JWT_SECRET`/`JITSI_JWT_APP_ID`, `SMTP_*`, `CLOUDINARY_*`,
  `PAYOUT_PROVIDER` y `FRONTEND_DEPLOY_HOOK_URL` (opcional, para regenerar el prerender público).
- Frontend (en tiempo de build): `VITE_API_URL` (URL pública de la API) y `VITE_SITE_URL` (dominio del sitio).

Cabeceras, caché y redirecciones: el frontend incluye `apps/web/public/_headers`, `apps/web/public/_redirects` y
`apps/web/public/404.html`. Si Render no los aplica automáticamente, replica lo mismo en la configuración de
Headers/Redirects del sitio.

**404 real (sin SSR):** las rutas **públicas** se sirven como HTML prerenderizado, así que una ruta desconocida
(p. ej. `/ruta-inexistente` o `/specialties/slug-inexistente`) devuelve **HTTP 404** con `404.html`. Las rutas de la
aplicación (paneles, cuenta, `/login`, etc.) se reescriben a `/index.html` según `_redirects`; **no hay `catch-all`**.
Las rutas dinámicas (`/specialties/{slug}`, `/doctors/{id}`) se sirven solo con barra final; la forma sin barra
responde 404 y `404.html` redirige al cliente a la forma canónica. Así se evita el 200 vacío y el soft 404.
Los médicos nuevos necesitan un redespliegue para generar su HTML; hasta entonces su perfil devuelve 404.
Si el hosting no aplica `_redirects`, replica esas reglas en el dashboard de Render y borra cualquier `catch-all` previo.

**Datos de prueba:** los médicos del seed se marcan `is_seed=true` y no se publican en producción. Antes de
producción real, ejecutar desde `apps/api`:

```bash
./venv/bin/python scripts/validate_seed_data.py
```

El script falla si encuentra un médico aprobado y publicado con nombre/correo de prueba o `is_seed=true`.
Para despublicar uno, poner `doctor_profiles.is_published=false` (conserva historial y citas).

**Prerender público:** el build genera HTML para especialidades y médicos aprobados. Si se configura
`FRONTEND_DEPLOY_HOOK_URL`, la API dispara un rebuild al aprobar o editar un médico, cambiar su foto o sus datos.
Sin hook, hay que redesplegar manualmente el frontend para que el perfil nuevo tenga HTML propio.

SEO: el `postbuild` genera HTML por ruta con meta tags, JSON-LD y `sitemap.xml`
(`scripts/generate-meta-pages.mjs` y `generate-sitemap.mjs`). Necesitan `VITE_API_URL` accesible durante el build;
si no, generan solo las rutas fijas sin romper el build. Las páginas no encontradas se marcan `noindex` desde el cliente.

**Barra final:** las rutas prerenderizadas viven en `dist/<ruta>/index.html`, así que su forma canónica lleva barra
final (`/como-funciona/`). `_redirects` redirige 301 la forma sin barra y el sitemap publica solo la forma canónica.
Si se cambia esta convención, actualizar a la vez `generate-meta-pages.mjs`, `generate-sitemap.mjs` y `_redirects`.

**Verificación de producción:** desde `apps/web`, ejecutar `npm run verify:prod`. Comprueba códigos HTTP, canonical,
OG, 404, cabeceras, caché, manifest y datos de prueba. Guarda la evidencia en `docs/evidencias/AAAA-MM-DD/`.
Antes de pasar a producción real, ejecutar `npm run verify:prod -- --strict`: también falla si quedan datos de prueba
publicados (por ejemplo, `Dr. Test`).

## 📝 Licencia

> Todos los usuarios tienen además el rol base **`patient`**. Un mismo usuario puede
> combinar varios roles (p. ej. `doctor` + `reviewer` + `patient`). Hay un usuario de soporte demo:
> `soporte.demo@sabiodoc.app` / `SupportDemo123!` (rol `support`), con su panel en `/support`.

Proyecto MVP - Uso interno.