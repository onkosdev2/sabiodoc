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
- **pgAdmin** en `http://localhost:5050` (usuario: admin@sabiodoc.local / admin123)

### Paso 3: Configurar y ejecutar Backend

```powershell
cd apps/api

# Crear entorno virtual
python -m venv venv
.\venv\Scripts\Activate.ps1

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

```powershell
cd apps/api
pytest app/tests/ -v
```

## 📝 Licencia

Proyecto MVP - Uso interno.
