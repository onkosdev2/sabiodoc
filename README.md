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
9. Paciente y médico pueden **solicitar retiros**; un admin los aprueba o rechaza.

El panel de la videoconsulta muestra el **costo real de la sesión**, el máximo retenido, el tiempo extra consumido, el saldo disponible y si el cronómetro está activo o en pausa por ausencia de alguno.

Variables de entorno (backend):

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| CREDITS_CURRENCY | Moneda del monedero | usd |
| WALLET_MIN_TOPUP_CENTS | Recarga mínima (centavos) | 500 |
| WALLET_MAX_TOPUP_CENTS | Recarga máxima (centavos) | 100000 |
| WALLET_MIN_WITHDRAWAL_CENTS | Retiro mínimo (centavos) | 1000 |
| PLATFORM_FEE_BPS | Comisión de plataforma (puntos básicos) | 0 |
| VIDEO_PRESENCE_TIMEOUT_SECONDS | Segundos sin señal antes de pausar el cronómetro | 30 |
| VIDEO_MIN_BILLABLE_MINUTES | Mínimo facturable si hubo sesión activa | 1 |

## 📋 Endpoints API

### Autenticación
- `POST /auth/register` - Registro de usuario
- `POST /auth/login` - Inicio de sesión
- `GET /auth/me` - Usuario actual

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
- `GET /admin/withdrawals` - (Admin) Solicitudes de retiro
- `POST /admin/withdrawals/{id}/process` - (Admin) Aprobar/rechazar un retiro

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

## 📝 Licencia

Proyecto MVP - Uso interno.