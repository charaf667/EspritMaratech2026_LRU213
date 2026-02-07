# OMNIA Charity Tracking

Field operations tracking system for charity aid distribution.

## Folder structure

```
/
├── apps/
│   ├── web/          # Next.js (React + TypeScript) — PWA frontend
│   ├── api/          # Django + DRF — core backend (auth, CRUD, business logic)
│   └── svc/          # FastAPI — internal compute services (STT, routing)
├── packages/
│   └── shared/       # (reserved) shared types/constants
├── .env.example      # Environment variable template
├── .editorconfig     # Editor formatting rules
├── .gitignore
└── package.json      # Root scripts for convenience
```

### Architecture rationale

- **Django/DRF is the single source of truth** for auth, RBAC, and all business CRUD.
- **FastAPI** runs as an internal-only microservice for compute-heavy tasks (speech-to-text, route optimization). It is **never called directly by the frontend**.
- **Next.js** communicates exclusively with Django. Django proxies requests to FastAPI when needed.

## Prerequisites

- **Node.js** >= 18 (tested with 24.x)
- **Python** >= 3.10
- **PostgreSQL** (required — ArrayField used in Family model)

## Quick start

### 1. Environment variables

```bash
cp .env.example .env
# Edit .env with your values (at minimum set DJANGO_SECRET_KEY and SVC_INTERNAL_TOKEN)
```

### 2. Backend (Django API) — port 8000

```bash
cd apps/api
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py seed_aid_types       # seed 10 aid types (idempotent)
python manage.py seed_demo_users      # seed admin + agent users (idempotent, dev only)
python manage.py seed_demo_data       # seed 7 families, 14 visits, cards, complaints
python manage.py runserver 0.0.0.0:8000
```

Demo users (password: `dev12345`):
- `admin@omnia.org` — role=admin, is_staff=True
- `sara@omnia.org` — role=agent

> **Note:** Reference data (aid types), demo users, and demo families are seeded via management commands, not migrations. Always run them after `migrate` on a fresh database.

### 3. Internal services (FastAPI) — port 8001

```bash
cd apps/svc
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### 4. Frontend (Next.js) — port 3000

```bash
cd apps/web
npm install
npm run dev
```

To connect the frontend to the real API (instead of mock data):
```bash
# In apps/web/.env.local
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Root convenience scripts

From the repo root:

```bash
npm run dev:web    # Start Next.js dev server
npm run dev:api    # Start Django dev server
npm run dev:svc    # Start FastAPI dev server
npm run migrate    # Run Django migrations
```

## Authentication & CSRF

This setup uses **session-based auth with httpOnly cookies** and **CSRF protection**.

### How CSRF works

1. **Frontend boots**: calls `GET /api/auth/csrf/` which returns a CSRF token and sets the `csrftoken` cookie.
2. **Safe requests** (GET, HEAD, OPTIONS): no CSRF token needed.
3. **Unsafe requests** (POST, PUT, PATCH, DELETE): the frontend reads the `csrftoken` cookie and sends it as the `X-CSRFToken` header.
4. **Django validates** that the header matches the cookie.

### Key settings

| Setting | Value | Why |
|---------|-------|-----|
| `SESSION_COOKIE_HTTPONLY` | `True` | Session cookie not readable by JS (XSS protection) |
| `CSRF_COOKIE_HTTPONLY` | `False` | CSRF cookie **must** be readable by JS to send the header |
| `CORS_ALLOW_CREDENTIALS` | `True` | Allows cookies to be sent cross-origin in dev |
| `CSRF_TRUSTED_ORIGINS` | Same as CORS origins | Django trusts the frontend origin for CSRF |

### RBAC

| Role | Families | Visits | Dashboard | Complaints |
|------|----------|--------|-----------|------------|
| agent | assigned_to=me OR created_by=me | own families only | denied (403) | own families only |
| admin | all | all | full access | all |

## API endpoints

### Django (public-facing)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health/` | None | Health check |
| GET | `/api/auth/csrf/` | None | Get CSRF token |
| POST | `/api/auth/login/` | None | Login |
| POST | `/api/auth/logout/` | Session | Logout |
| GET | `/api/auth/me/` | Session | Current user |
| GET | `/api/aid-types/` | Session | List 10 aid types |
| GET | `/api/families/` | Session | List families (paginated, filterable) |
| GET | `/api/families/{id}/` | Session | Family detail |
| POST | `/api/families/` | Session | Create family |
| GET | `/api/visits/?family_id={id}` | Session | List visits for family |
| POST | `/api/visits/` | Session | Create visit (wizard) |
| POST | `/api/attachments/` | Session | Upload attachment (multipart) |
| DELETE | `/api/attachments/{id}/` | Session | Soft-delete attachment |
| POST | `/api/feeling/redeem/` | None | Redeem beneficiary code |
| GET | `/api/feeling/card/{token}/` | None | Read-only beneficiary card |
| GET | `/api/dashboard/` | Admin | Admin dashboard KPIs |
| GET | `/api/complaints/` | Session | List complaints |
| POST | `/api/stt/transcribe-segment` | Session | Transcribe audio (proxied to FastAPI) |

### FastAPI (internal only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/stt/transcribe-segment` | X-Internal-Token | STT stub |
| POST | `/routing/compute` | X-Internal-Token | Route optimization stub |

> Full API contract with request/response shapes: [apps/api/API_CONTRACT.md](apps/api/API_CONTRACT.md)

## Demo script

A bash script exercises the full PRD demo path:

```bash
cd apps/api
bash demo.sh
```

This tests: health → CSRF → login → me → aid-types → families (search, filter, RBAC) → visits → create visit → feeling portal → dashboard → logout.

## i18n

The frontend supports French (FR) and Arabic (AR with RTL). A language switcher toggles between them and updates `<html lang>` and `<html dir>` attributes.

## PWA

- Web manifest at `/manifest.json`
- Service worker at `/sw.js` (network-first with offline fallback)
- Placeholder icons in `/public/icons/` (replace with real assets)

## TODOs

- STT engine integration (Whisper, etc.) — currently returns stub
- OSRM integration for route optimization
- PWA icons (replace SVG placeholders with proper PNGs)
- Production deployment configuration (Docker Compose)
- Offline queue (IndexedDB + sync)
