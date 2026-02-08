# OMNIA — Charity Field Operations Tracker

> Desktop-first admin dashboard + mobile-first agent PWA for tracking humanitarian aid distribution, family follow-ups, complaints, emergency incidents, and AI-powered operational briefings.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Repository Structure](#repository-structure)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Quick Start](#quick-start)
6. [Environment Variables](#environment-variables)
7. [Authentication & Security](#authentication--security)
8. [Data Models](#data-models)
9. [API Endpoints](#api-endpoints)
10. [Frontend — Pages & Features](#frontend--pages--features)
11. [Agent Mobile UX](#agent-mobile-ux)
12. [Admin WOW Modules](#admin-wow-modules)
13. [Design System](#design-system)
14. [Accessibility (WCAG 2.2)](#accessibility-wcag-22)
15. [Internationalization (i18n)](#internationalization-i18n)
16. [Offline & PWA](#offline--pwa)
17. [Testing](#testing)
18. [LAN / Real-Device Testing](#lan--real-device-testing)
19. [Seed Data](#seed-data)
20. [Demo Script](#demo-script)
21. [Known Limitations & Roadmap](#known-limitations--roadmap)
22. [Bug Fixes & Hardening (Latest)](#bug-fixes--hardening-latest)
23. [License](#license)

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                     Browser / PWA                         │
│  Next.js 16 · React 19 · Tailwind v4 · Lucide · Leaflet  │
└──────────────────────┬────────────────────────────────────┘
                       │ HTTP (cookies + CSRF)
┌──────────────────────▼────────────────────────────────────┐
│               Django 4.2 + DRF  (port 8000)               │
│  Session auth · RBAC · CRUD · Audit · WebAuthn · Exports  │
└──────────────────────┬────────────────────────────────────┘
                       │ HTTP (X-Internal-Token)
┌──────────────────────▼────────────────────────────────────┐
│               FastAPI  (port 8001, internal)               │
│  Whisper STT · EasyOCR CIN · OSRM Routing · Ollama LLM    │
└──────────────────────┬────────────────────────────────────┘
                       │ HTTP (localhost)
┌──────────────────────▼────────────────────────────────────┐
│               Ollama  (port 11434, local)                  │
│   Qwen 2.5:3b — optimized structured JSON for Ops Brief     │
└───────────────────────────────────────────────────────────┘
```

- **Django/DRF** is the single source of truth for auth, RBAC, and all business CRUD.
- **FastAPI** runs as an internal-only microservice for compute-heavy tasks (STT, OCR, routing, LLM). It is **never called directly by the browser** — Django proxies requests.
- **Ollama** runs as a local LLM server for AI Ops Brief generation. FastAPI calls it via Chat API with JSON Schema enforcement, tuned for `qwen2.5:3b`.
- **Next.js** communicates exclusively with Django over session cookies.

---

## Repository Structure

```
/
├── apps/
│   ├── web/                 # Next.js 16 — PWA frontend
│   │   ├── src/
│   │   │   ├── app/         # App Router pages (login, app/, feeling/, field/, offline/)
│   │   │   ├── components/
│   │   │   │   └── ds/      # Design system (27 components)
│   │   │   ├── i18n/        # Translations (FR, AR, TN — 250+ keys per locale)
│   │   │   └── lib/         # API client, auth context, offline DB, accessibility
│   │   ├── public/          # PWA manifest, service worker, icons
│   │   ├── e2e/             # Playwright E2E tests (auth + sprint-smoke)
│   │
│   ├── api/                 # Django 4.2 + DRF — core backend
│   │   ├── apps/            # 17 Django apps (see below)
│   │   ├── config/          # Settings, URLs, WSGI, throttles, exception handler
│   │   └── manage.py
│   │
│   └── svc/                 # FastAPI — internal compute services
│       ├── routers/         # stt.py, routing.py, ocr.py, ops_brief.py, health.py
│       ├── schemas/         # ops_brief.schema.json (JSON Schema for LLM output)
│       ├── tests/           # test_ops_brief.py (15 tests), test_live_ai_eval.py
│       ├── logs/            # ops_brief.log (auto-generated runtime)
│       ├── middleware.py    # X-Internal-Token verification
│       └── main.py
│
├── SOT/                     # Source of Truth docs (PRD, specs)
├── LAN_TESTING.md           # Real-device LAN testing guide
├── DEMO_SCRIPT.md           # 60-second jury demo script
├── OPS_BRIEF_TEST_CHECKLIST.md  # AI Ops Brief manual test checklist (12 sections)
├── UX_SPEC_MAP_UBER.md      # Uber/Google Maps UX optimization spec for agent /app
├── CLAUDE_OPUS_DEBUG_PROMPT.md  # Debug prompt for mobile UX issues
├── juryconnnexionapp.md     # LAN connection guide for jury demo
├── .env.example             # Environment variable template
├── .editorconfig
├── .gitignore
└── package.json             # Root convenience scripts
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router, Turbopack) | 16.1 |
| | React | 19.2 |
| | Tailwind CSS | 4.1 |
| | Lucide React (icons) | 0.563 |
| | Leaflet + react-leaflet (maps) | 1.9 / 5.0 |
| | idb (IndexedDB) | 8.0 |
| | qrcode.react | 4.2 |
| | Playwright (E2E) | 1.58 |
| **Backend** | Django + DRF | 4.2 / 3.14 |
| | PostgreSQL (or SQLite for dev) | 15+ |
| | django-cors-headers | 4.3 |
| | webauthn (py-webauthn) | 2.1 |
| | django-ratelimit | 4.1 |
| | openpyxl (Excel exports) | 3.1 |
| | python-magic (file validation) | 0.4 |
| **Services** | FastAPI + Uvicorn | 0.109 |
| | faster-whisper (STT) | 1.0 |
| | EasyOCR (CIN scanning) | 1.7 |
| | pydub (audio conversion) | 0.25 |
| | httpx (async HTTP client) | 0.27 |
| **AI / LLM** | Ollama (local inference server) | 0.15+ |
| | Qwen 2.5:3b (1.9 GB, optimized for ≤8GB VRAM) | — |
| **Email** | Resend (API-based email delivery) | 2.0 |
| **HTTPS (dev)** | mkcert (local CA for LAN testing) | 1.4 |
| **Monitoring** | Sentry (optional) | — |

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js** ≥ 18 | Tested with 24.x |
| **Python** ≥ 3.10 | Tested with 3.12 |
| **PostgreSQL** ≥ 13 | `ArrayField` used in Family model. SQLite works for basic dev but some features degrade. |
| **ffmpeg** | Required for STT audio conversion (`pydub` dependency) |
| **Ollama** (optional) | Required only for AI Ops Brief. Install from https://ollama.com |
| **mkcert** (optional) | Required for HTTPS LAN testing (WebAuthn on phone). Download from https://github.com/FiloSottile/mkcert |

---

## Quick Start

### 1. Clone & configure

```bash
git clone <repo-url> && cd LRU213
cp .env.example .env
# Edit .env — at minimum set DJANGO_SECRET_KEY and SVC_INTERNAL_TOKEN
```

### 2. Backend — Django API (port 8000)

```bash
cd apps/api
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
# Windows only (libmagic):
pip install python-magic-bin

python manage.py migrate
python manage.py seed_aid_types       # 10 aid types (idempotent)
python manage.py seed_demo_users      # admin + agent (idempotent)
python manage.py seed_demo_data       # 8 families, 14 visits, 4 complaints, 7 cards, 3 notif templates
python manage.py runserver 0.0.0.0:8000
```

**Demo users** (password: `dev12345`):
| Email | Role | Notes |
|-------|------|-------|
| `admin@omnia.org` | admin | is_staff=True, full dashboard access |
| `sara@omnia.org` | agent | Field agent, assigned families only |

### 3. Internal Services — FastAPI (port 8001)

```bash
cd apps/svc
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

> The Whisper model is preloaded on startup (~2-3 min first time). Subsequent STT requests are fast.

### 3b. Ollama — Local LLM (optional, for AI Ops Brief)

```bash
# Install from https://ollama.com then:
ollama pull qwen2.5:3b       # 1.9 GB — recommended, fast on GPU
# Verify:
curl http://127.0.0.1:11434/api/tags
```

**Optimized for `qwen2.5:3b`** — the Ops Brief system is tuned for this model:
- **Chat API** (`/api/chat`) instead of generate — better instruction following
- **Reduced context** (`num_ctx=4096`) — saves VRAM, faster inference
- **Low temperature** (`0.05`) — near-deterministic JSON output
- **Output cap** (`num_predict=2048`) — prevents runaway generation
- **Concise prompts** in French — small models need short, directive instructions
- **Lenient validation** — `_patch_meta()` fixes hallucinated timestamps/model names

> **GPU sizing**: `qwen2.5:3b` (1.9 GB) fits easily in 4 GB+ VRAM. Larger models (7B=4.7 GB, 14B=9 GB) need proportionally more VRAM. Use `ollama ps` to verify.

### 4. Frontend — Next.js (port 3000)

```bash
cd apps/web
npm install
npm run dev
```

**Connect to real API** (in `apps/web/.env.local`):
```env
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

When `NEXT_PUBLIC_USE_API=false` (default if not set), the app uses in-memory mock data — no backend needed.

### Root convenience scripts

```bash
npm run dev:web         # Start Next.js
npm run dev:api         # Start Django
npm run dev:svc         # Start FastAPI
npm run migrate         # Run Django migrations
npm run makemigrations  # Create new migrations
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | `insecure-dev-key-change-me` | **Change in production** |
| `DJANGO_DEBUG` | `True` | Set `False` in production |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `SVC_INTERNAL_TOKEN` | `change-me-internal-secret` | Shared secret for Django→FastAPI |
| `NEXT_PUBLIC_USE_API` | `false` | `true` to connect frontend to real backend |
| `WEBAUTHN_RP_ID` | `localhost` | Relying party ID for passkeys |
| `WEBAUTHN_ORIGIN` | `http://localhost:3000` | Expected origin for WebAuthn |
| `WHISPER_MODEL_SIZE` | `base` | Whisper model: tiny, base, small, medium, large-v3 |
| `SENTRY_DSN` | — | Optional Sentry error monitoring |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API endpoint (FastAPI svc) |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Ollama model for ops brief (tuned for 3B) |
| `OPS_BRIEF_ENABLED` | `true` (dev) | Enable/disable AI ops brief feature |
| `OPS_BRIEF_TIMEOUT_SECONDS` | `300` | Timeout for Ollama LLM call |
| `RESEND_API_KEY` | — | Resend API key for email delivery. If empty, emails print to console. |
| `DEFAULT_FROM_EMAIL` | `OMNIA <noreply@omnia.org>` | Sender address for emails |

---

## Authentication & Security

### Session-based auth with CSRF

1. **Frontend boots** → calls `GET /api/auth/csrf/` → sets `csrftoken` cookie
2. **Login** → `POST /api/auth/login/` with `{email, password}` → sets `sessionid` cookie
3. **Authenticated requests** → cookies sent automatically; `X-CSRFToken` header on unsafe methods
4. **WebAuthn (Passkeys/Face ID)** → optional passwordless flow, same session cookie outcome

### Security settings

| Setting | Value | Reason |
|---------|-------|--------|
| `SESSION_COOKIE_HTTPONLY` | `True` | XSS protection — JS can't read session |
| `CSRF_COOKIE_HTTPONLY` | `False` | JS must read CSRF cookie to send header |
| `CORS_ALLOW_CREDENTIALS` | `True` | Cross-origin cookies in development |
| `SESSION_COOKIE_AGE` | 7 days | Auto-refreshed on every request |
| Rate limiting | 5/min login, 60/min anon, 300/min user | DRF throttling |

### WebAuthn (Passkeys / Face ID / Touch ID)

Full FIDO2 WebAuthn implementation:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/webauthn/register/options/` | Session | Generate registration challenge |
| `POST /api/auth/webauthn/register/verify/` | Session | Verify attestation & store credential |
| `POST /api/auth/webauthn/login/options/` | None | Generate authentication challenge |
| `POST /api/auth/webauthn/login/verify/` | None | Verify assertion & issue session |
| `GET /api/auth/webauthn/credentials/` | Session | List user's passkeys |
| `DELETE /api/auth/webauthn/credentials/{id}/` | Session | Remove a passkey |

### RBAC

| Role | Families | Visits | Dashboard | Complaints | Emergencies | Users |
|------|----------|--------|-----------|------------|-------------|-------|
| **agent** | assigned/created only | own families | 403 | own families | trigger + view own | — |
| **admin** | all | all | full access | all | all | manage all |

---

## Data Models

20 Django apps, 18+ models:

| App | Models | Description |
|-----|--------|-------------|
| `accounts` | `User`, `WebAuthnCredential` | Custom user (UUID PK, email login, role: agent/admin) + passkey storage |
| `families` | `Family`, `VulnerabilityTag`, `FamilyVulnerabilityTag` | Beneficiary families with GPS, priority, vulnerability tags, household data |
| `visits` | `Visit`, `VisitAid` | Agent visits with motive, notes, GPS, distributed aids |
| `aids` | `AidType` | Reference table: 10 aid types (food, medical, education…) |
| `complaints` | `Complaint`, `ComplaintMessage` | Issue tracking with priority, status workflow, threaded messages |
| `emergencies` | `EmergencyType`, `EmergencyIncident`, `EmergencyAction` | Emergency triggers with severity, status workflow, timeline actions |
| `attachments` | `Attachment` | Generic file attachments with MIME validation, soft delete |
| `attestations` | `VisitAttestation` | Sign-on-glass delivery proof (signature data URL) |
| `cards` | `BeneficiaryCard` | Short-code tokens for the beneficiary portal |
| `audit` | `AuditLog` | Immutable trail: actor, action, entity, timestamp, metadata |
| `notifications` | `NotificationTemplate`, `NotificationLog` | Multi-channel notification system (email, SMS, push) |
| `exports` | — (views only) | CSV + Excel export for families and visits |
| `dashboard` | — (views only) | Aggregated KPIs, SLA, workload, data quality |
| `ops_brief` | — (views only) | AI ops brief: SSOT input aggregation + LLM generation via FastAPI |
| `ocr` | — (proxy) | Proxies CIN OCR requests to FastAPI |
| `stt` | — (proxy) | Proxies STT requests to FastAPI |
| `routing` | — (proxy) | Proxies route computation to FastAPI |
| `health` | — (view) | Health check endpoint |
| `services` | — (client) | `svc_client.py` — Django→FastAPI HTTP bridge (STT, OCR, routing, ops brief) |
| `common` | `UUIDModel`, `TimeStampedUUIDModel` | Abstract base models |

---

## API Endpoints

### Core Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health/` | — | Health check |
| GET | `/api/auth/csrf/` | — | Get CSRF token |
| POST | `/api/auth/login/` | — | Email/password login |
| POST | `/api/auth/logout/` | Session | Logout |
| GET | `/api/auth/me/` | Session | Current user info |
| GET | `/api/auth/users/` | Admin | List all users |

### Domain CRUD

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST | `/api/families/` | Session | List (paginated, search, filter) / Create |
| GET/PATCH | `/api/families/{id}/` | Session | Detail / Update |
| POST | `/api/families/{id}/assign/` | Admin | Assign agent |
| POST | `/api/families/{id}/merge/` | Admin | Merge duplicate families |
| GET/POST | `/api/visits/` | Session | List (filter by family_id) / Create |
| GET | `/api/aid-types/` | Session | List 10 aid types |
| POST | `/api/attachments/` | Session | Upload (multipart) |
| DELETE | `/api/attachments/{id}/` | Session | Soft-delete |
| GET/POST | `/api/complaints/` | Session | List / Create |
| PATCH | `/api/complaints/{id}/` | Session | Update status/assignment |
| POST | `/api/complaints/{id}/messages/` | Session | Add message |
| GET/POST | `/api/emergencies/` | Session | List / Trigger |
| PATCH | `/api/emergencies/{id}/` | Session | Update status |
| POST | `/api/emergencies/{id}/actions/` | Session | Add action note |
| GET | `/api/emergencies/types/` | Session | List emergency types |
| POST | `/api/visits/{visit_id}/attestation/` | Session | Sign-on-glass |
| GET | `/api/attestations/` | Session | List attestations |

### Beneficiary Portal (no auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/feeling/redeem/` | Redeem short code → get token |
| GET | `/api/feeling/card/{token}/` | Read-only beneficiary card |

### Admin Dashboard & Exports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/` | Admin | KPIs, SLA, workload, data quality, critical queue |
| GET | `/api/exports/families/csv/` | Admin | Export families CSV |
| GET | `/api/exports/families/xlsx/` | Admin | Export families Excel |
| GET | `/api/exports/visits/csv/` | Admin | Export visits CSV |
| GET | `/api/exports/visits/xlsx/` | Admin | Export visits Excel |

### AI Ops Brief (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/ops-brief-input/` | Admin | Aggregated SSOT data (KPIs, overdue, urgent, complaints, duplicates, workload) |
| POST | `/api/admin/ops-brief-generate/` | Admin | Generate AI brief via Ollama (returns deterministic fallback if LLM unavailable) |

### Proxied to FastAPI

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/stt/transcribe-segment/` | Speech-to-text (Whisper) |
| POST | `/api/ocr/cin/` | CIN card OCR (EasyOCR) |
| POST | `/api/routing/compute/` | Route optimization (OSRM) |

### FastAPI (internal, port 8001)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/stt/transcribe-segment` | X-Internal-Token | Whisper transcription |
| POST | `/ocr/cin` | X-Internal-Token | CIN card extraction |
| POST | `/routing/compute` | X-Internal-Token | OSRM route computation |
| POST | `/v1/ops/brief/generate` | X-Internal-Token | Ollama LLM ops brief (schema-validated + grounding-checked) |

> Full request/response shapes: [`apps/api/API_CONTRACT.md`](apps/api/API_CONTRACT.md)

---

## Frontend — Pages & Features

| Route | Role | Description |
|-------|------|-------------|
| `/login` | — | Email/password + passkey (Face ID / Touch ID) login. Passkey button auto-hidden on insecure contexts (HTTP LAN). |
| `/app` | agent | Map/List single-screen with bottom sheet family detail + quick actions (Call, Navigate, Add Visit) + Create Family FAB |
| `/app/new-visit` | agent | 3-step visit wizard: family → aids/notes/STT/attachments → review + QR + attestation |
| `/app/admin` | admin | Desktop-first dashboard with collapsible sidebar (8 sections) + **mobile bottom nav bar** |
| `/app/admin?section=dashboard` | admin | KPI cards, SLA gauge, workload table, critical queue, complaints, aid distribution, data quality |
| `/app/admin?section=families` | admin | Family management: search, assign, export CSV/Excel, completeness scores |
| `/app/admin?section=users` | admin | User grid with roles and zones |
| `/app/admin?section=complaints` | admin | Full complaints management with detail modal |
| `/app/admin?section=emergencies` | admin | Emergency incident journal |
| `/app/admin?section=planner` | admin | **Mission Planner**: filter by priority/zone, compute OSRM route, ordered stops + distance/duration, export plan, assign to agent |
| `/app/admin?section=duplicates` | admin | **Smart Duplicate Merge**: suspected duplicates queue with similarity scores, side-by-side compare, safe merge with confirmation |
| `/app/admin?section=ops-brief` | admin | **AI Ops Brief**: AI-powered 24h operational briefing with alerts, actions, grounded citations |
| `/app/account` | all | Profile, passkey management |
| `/feeling` | — | Beneficiary portal: redeem code → view aid history |
| `/feeling/card/[token]` | — | Read-only beneficiary card with QR code |
| `/field` | agent | Field map view |
| `/offline` | — | Static offline fallback page |

---

## Agent Mobile UX

Designed for **single-screen, one-hand** operation on phones:

| Feature | Implementation |
|---------|---------------|
| **Map/List toggle** | Segmented control `[Carte] [Liste]` — large touch targets, synced data |
| **Family bottom sheet** | Tapping a family opens a bottom sheet (mobile) or side panel (desktop) with drag handle, slide-up animation |
| **Quick actions** | 3 action buttons in the bottom sheet: **Call** (tel: link), **Navigate** (Google Maps), **Add Visit** |
| **Info grid** | Members count, last visit, zone — at a glance |
| **Visit history** | Scrollable list of past visits with aid labels |
| **Create Family FAB** | "+ Famille" button in mobile bottom bar → modal with geolocation auto-fill |
| **No deep navigation** | Common actions never force the agent through a separate page |

---

## Admin WOW Modules

### Mission Planner (`?section=planner`)

Admin can plan optimized routes for field agents:

1. **Filter** families by priority (overdue/urgent/normal) and zone
2. **Select** families with checkboxes (select all / deselect all)
3. **Compute route** — calls OSRM via Django→FastAPI pipeline
4. **View result**: ordered stops with numbered markers, total distance (km), total duration (min)
5. **Export plan** — copies ordered stop list to clipboard
6. **Assign to agent** — bulk-assigns all route families to a selected agent

### Smart Duplicate Merge (`?section=duplicates`)

Admin can review and resolve suspected duplicate families:

1. **Queue** — lists suspected duplicates from the dashboard API with similarity scores (%) and reasons
2. **Compare** — side-by-side table highlighting field-level differences (name, phone, address, zone, members, priority)
3. **Merge** — choose which family to keep as target; visits, complaints, and beneficiary cards are transferred from source to target
4. **Safety** — clear warning about what will happen before merge; audit log entry created
5. **Ignore** — dismiss false positives from the queue

### AI Ops Brief (`?section=ops-brief`)

Admin can generate an AI-powered 24-hour operational briefing:

1. **Generate** — click button to produce a structured brief from SSOT data via local Ollama LLM
2. **Summary** — concise executive summary of operational status
3. **Alerts** — severity-tagged alerts (critical/warning/info) with grounded citations
4. **Actions** — prioritized action items with deep links to relevant admin sections
5. **Sections** — detailed analysis with bullet points, severities, and source citations
6. **Fallback** — deterministic non-AI brief returned when Ollama is unavailable
7. **Verify** — banner reminds admin that AI output should be verified against sources

**Architecture**: Django aggregates SSOT data → forwards to FastAPI → FastAPI calls Ollama with JSON Schema enforcement → validates output schema + grounding → returns to Django → serves to frontend.

**Requirements**: Ollama running locally. See [Quick Start §3b](#3b-ollama--local-llm-optional-for-ai-ops-brief) for model installation.

**Test checklist**: [`OPS_BRIEF_TEST_CHECKLIST.md`](OPS_BRIEF_TEST_CHECKLIST.md) — 12 sections covering backend, frontend, schema, grounding, i18n, accessibility, edge cases.

---

## Design System

27 components in `apps/web/src/components/ds/`:

| Component | Description |
|-----------|-------------|
| `Badge` | Status badges (critical, warning, success, info, neutral) |
| `Button` | Primary, secondary, ghost, danger variants; sm/md/lg sizes |
| `Card`, `CardHeader`, `CardContent` | Elevated content containers |
| `Chip` | Toggle chips for filtering |
| `Input` | Text input with label, icon, error state |
| `TabsNav` | Horizontal tab navigation |
| `Stepper` | Multi-step progress indicator |
| `Modal` | Dialog with focus trap and return-focus |
| `Toast` | Status messages (aria-live) |
| `Skeleton`, `CardSkeleton` | Loading placeholders |
| `EmptyState` | No-data placeholder |
| `MapListLayout` | Split map + list layout |
| `PushToTalk` | Hold-to-record STT button |
| `AttachmentChip` | File attachment display |
| `AccessibilityPanel` | Settings panel (6 toggles) |
| `TTSButton` | Browser text-to-speech (read aloud) |
| `InterviewWizard` | 1-question-per-screen accessible wizard |
| `InterviewFamilyStep` | Family selection in interview mode |
| `InterviewReviewStep` | Review step in interview mode |
| `RoutePlanner` | OSRM route visualization (agent + admin) |
| `CINScanner` | CIN card OCR capture |
| `EmergencyFAB` | Floating action button for emergencies |
| `EmergencyTriggerSheet` | Bottom sheet for triggering emergencies |
| `EmergencyJournal` | Emergency timeline display |
| `EmergenciesPanel` | Admin emergencies management |
| `SignaturePad` | Sign-on-glass for visit attestations |
| `AttestationCard` | Attestation display |

All components use CSS custom properties from `globals.css` (light + dark + RTL tokens).

---

## Accessibility (WCAG 2.2)

### 6 User-Toggleable Enhancements

| Enhancement | Description |
|-------------|-------------|
| **Easy Read** | Hides secondary/tertiary text (CSS classes `a11y-secondary`, `a11y-tertiary`) |
| **Large / XL Text** | CSS variable overrides for font-size, spacing, line-height |
| **High Contrast** | Enhanced borders, text contrast, 3px focus rings |
| **One-Hand Mode** | Fixed bottom action bar on mobile (safe-area aware) |
| **Interview Mode** | 1 question per screen, large controls, full data parity |
| **TTS (Read Aloud)** | Browser `SpeechSynthesis` API, graceful fallback |

### WCAG Compliance Checklist

- Touch targets ≥ 48px (`--touch-target-min`)
- Focus visible: 2px/3px focus ring on all interactive elements
- Keyboard navigation: Modal focus trap + return focus
- Non-color-only indicators: Badge uses icon + text + border shape
- Labels: `aria-label` on icon buttons, `aria-describedby` on errors
- Status messages: `aria-live` on Toast and offline banner
- Admin sidebar: `role="navigation"`, `aria-current="page"`, `aria-label`
- All sections: `role="region"` with descriptive `aria-label`

### Key files

- `src/lib/accessibility-context.tsx` — `A11yProvider`, 6 toggles persisted to `localStorage`
- `src/components/ds/AccessibilityPanel.tsx` — Settings panel
- `src/app/globals.css` — CSS rules for all 6 enhancements

---

## Internationalization (i18n)

| Locale | Language | Direction | Status |
|--------|----------|-----------|--------|
| `fr` | French | LTR | ✅ 250+ keys |
| `ar` | Arabic (MSA) | RTL | ✅ 250+ keys |
| `tn` | Tunisian Arabic | RTL | ✅ 250+ keys |

- Language switcher in header and login page
- Automatically sets `<html lang>` and `<html dir>` attributes
- All UI strings go through `t("key")` — no hardcoded text
- Translation file: `apps/web/src/i18n/translations.ts`

---

## Offline & PWA

| Feature | Implementation |
|---------|---------------|
| Web manifest | `/public/manifest.json` |
| Service worker | `/public/sw.js` — network-first with offline fallback |
| Offline page | `/offline` — static fallback when network unavailable |
| IndexedDB cache | `idb` library — families, visits, aid types cached locally |
| Mutation outbox | Queued POST/PUT requests replayed when online |
| Outbox indicator | Badge in header shows pending sync count |

---

## Testing

### E2E (Playwright)

```bash
cd apps/web
npx playwright install
npx playwright test
```

**Test suites:**

| File | Tests | Coverage |
|------|-------|----------|
| `e2e/auth.spec.ts` | 18 | Login, logout, session persistence, CSRF, protected routes, RBAC, cookie security, API endpoints |
| `e2e/sprint-smoke.spec.ts` | 6 | Agent: Map/List toggle + bottom sheet + Create Family; Admin: dashboard + Mission Planner + Duplicate Merge + sidebar links |

### FastAPI — Ops Brief (15 tests)

```bash
cd apps/svc
python -m pytest tests/test_ops_brief.py -v
```

Covers: valid output, missing fields, invalid severity, priority range, additional properties, grounding check, `data_missing` citation, prompt building, fallback.

### Backend

```bash
cd apps/api
python manage.py test
```

### Build verification

```bash
cd apps/web
npm run build    # TypeScript + Next.js production build (Turbopack)
npm run lint     # ESLint
```

---

## LAN / Real-Device Testing

Full step-by-step guide: [`LAN_TESTING.md`](LAN_TESTING.md)

**Quick summary:**

1. **Generate HTTPS certs** with mkcert: `mkcert.exe localhost 127.0.0.1 <LAN_IP>`
2. **Install CA root** on phone: send `rootCA.pem` → install as trusted CA
3. Set `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to include `https://<LAN_IP>:3000`
4. Start Django (`0.0.0.0:8000`) + Next.js with HTTPS (`--experimental-https --experimental-https-key ... --experimental-https-cert ...`)
5. Open `https://<LAN_IP>:3000` on phone

> **HTTPS enables WebAuthn/Face ID** on phone. Without mkcert, use email/password login (passkey button auto-hides on HTTP).

**30-item verify checklist** in `LAN_TESTING.md` covers: auth + Face ID, map/bottom sheet, admin dashboard, 6 accessibility toggles, i18n/RTL, offline/PWA.

### Accessibility testing on mobile

- **VoiceOver** (iPhone): Settings → Accessibility → VoiceOver → On
- **TalkBack** (Android): Settings → Accessibility → TalkBack → On
- Test all 6 accessibility enhancements with screen readers enabled
- Verify touch targets ≥ 48px, focus order, and `aria-live` announcements

---

## Seed Data

Run after `migrate` on a fresh database:

```bash
python manage.py seed_aid_types       # 10 aid types (idempotent)
python manage.py seed_demo_users      # 2 users (idempotent)
python manage.py seed_demo_data       # 8 families, 14 visits, 4 complaints, 7 cards, 3 notification templates
```

---

## Demo Script

Full 60-second jury demo flow: [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)

**Flow:** Agent mobile (login → Map/List → bottom sheet → Add Visit → Create Family) → Admin desktop (dashboard → KPIs → Mission Planner → route compute → Duplicate Merge → compare → merge → AI Ops Brief)

**Key talking points:** Accessibility (6 WCAG toggles), i18n (FR/AR/TN + RTL), offline-first, real-device tested, AI-powered ops briefing

---

## Known Limitations & Roadmap

| Item | Status | Notes |
|------|--------|-------|
| PWA icons | Placeholder SVGs | Replace with proper PNGs for production |
| Docker Compose | Not yet | Planned for production deployment |
| ffmpeg dependency | Manual install | Required for STT; not bundled |
| OSRM routing | Uses public demo server | Self-host for production |
| Email notifications | ✅ Working | Resend integration with 5 HTML templates (visit report, overdue, complaint, welcome, emergency). Set `RESEND_API_KEY` to activate. |
| Sentry monitoring | Optional | Set `SENTRY_DSN` to enable |
| Map polyline in Mission Planner | Planned | Route currently shows ordered list; map polyline rendering next |
| Drag-to-reorder route stops | Planned | Manual reorder after route computation |
| Ollama GPU on Windows | ✅ Fixed | System now defaults to `qwen2.5:3b` (1.9 GB). Params tuned: `num_ctx=4096`, `temp=0.05`, Chat API. |
| WebAuthn on HTTP LAN | By design | Passkeys require HTTPS or localhost. Button auto-hides on insecure context. |
| STT on HTTP LAN | By design | `getUserMedia` requires secure context on iOS Safari. Shows i18n message. |
| Uber-like map UX | Spec ready | `UX_SPEC_MAP_UBER.md` — dev-ready spec for map-first + bottom sheet pattern |

---

## Bug Fixes & Hardening (Latest)

Recent fixes applied to improve mobile UX and admin reliability:

| Fix | File | Description |
|-----|------|-------------|
| **Leaflet NaN crash** | `MapView.tsx` | Guard `FlyToSelected` against NaN lat/lng; filter invalid coords before rendering markers |
| **Map invalidateSize** | `MapView.tsx` | Added `InvalidateSize` component to trigger `map.invalidateSize()` on visibility changes |
| **Hydration error** | `InterviewWizard.tsx` | Replaced nested `<button>` with `<div role="button">` to fix React hydration mismatch |
| **Admin mobile nav** | `admin/layout.tsx` | Added mobile bottom navigation bar (`hidden md:flex` → visible on mobile with horizontal scroll) |
| **TTS Tunisian dialect** | `TTSButton.tsx` | `utterance.lang` now uses `ar-TN` for `tn` locale |
| **STT secure context** | `PushToTalk.tsx` | Checks `isSecureContext`; shows i18n message on HTTP LAN instead of crashing |
| **Passkey secure context** | `login/page.tsx` | Passkey button hidden when not in secure context (HTTPS or localhost) |
| **HTTPS LAN (mkcert)** | `next.config.ts` | mkcert certs for HTTPS dev server — enables WebAuthn/Face ID on phone |
| **API proxy rewrites** | `next.config.ts`, `api.ts` | Next.js rewrites `/api/*` → Django, fixing cross-origin 403 errors |
| **Resend email backend** | `notifications/backends.py` | Custom Django email backend via Resend API with 5 HTML templates |
| **Ops Brief optimization** | `svc/routers/ops_brief.py` | Refactored for `qwen2.5:3b`: Chat API, `num_ctx=4096`, `temp=0.05`, concise French prompts |
| **Keyboard shortcut hints** | `Button.tsx` | Added optional `kbdHint` prop to show shortcut badge on `focus-visible` |
| **Complaint flow clarity** | `new-visit/page.tsx` | Replaced dead "Créer plainte" button with informational text (`complaintSentWithVisit`) |
| **Admin dead buttons** | `admin/page.tsx` | Connected "Voir" (family open), disabled "Ajouter" (V2 tooltip), connected "Ignorer" (dismiss duplicate) |
| **Admin loading states** | `admin/page.tsx` | Added loading spinner, error banner, and empty state to FamiliesView |
| **Family ID crash** | `app/page.tsx` | Safety guard on `family.id.substring()` when id is undefined |

---

## License

Private — all rights reserved.
