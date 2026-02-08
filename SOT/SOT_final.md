# SOT FINAL — OMNIA Charity Field Operations Tracker (V1 Demo-Ready)
**Scope verrouillé:** Sprint “WOW Admin + Mobile Field UX (single-screen)” + LAN real-device testing + smoke tests  
**Statut:** FINAL (à garder comme unique SOT opérationnel)  
**Dépôts/documents de référence:** README.md, LAN_TESTING.md, DEMO_SCRIPT.md, API_CONTRACT.md

---

## 1) Objectif produit (V1)
Construire une webapp **admin desktop-first** + **agent mobile-first PWA** pour suivre:
- Familles bénéficiaires (GPS, vulnérabilités, priorités)
- Visites (aides distribuées, notes, pièces jointes, attestation)
- Plaintes & urgences
- Pilotage (KPI, workload, qualité data)
- Démo jury: **effet “wow” visible** côté admin **sans risque** (routing + merge explicable), et UX agent ultra fluide.

---

## 2) Principes UX non négociables
### Agent (téléphone uniquement)
- **Single-screen**: pas de navigation profonde pour les actions fréquentes.
- **Map/List toggle** en haut, synchronisé.
- Tap famille → **bottom sheet unique** (mobile) / side panel (desktop) avec actions rapides.
- **Créer famille** en modal/sheet (champs essentiels d’abord, “Plus de détails” optionnel).
- **Ajouter visite** = wizard simple (1 question/écran si mode interview, sinon wizard existant 3 étapes).
- **Offline-friendly**: ne jamais perdre une saisie (draft/outbox si dispo).

### Admin/Coordinateur (wow + crédible)
- “Wow” = **actionnable** + **explicable** + **déterministe** (pas d’IA gadget).
- Deux modules WOW V1:
  1) **Mission Planner** (routing OSRM via pipeline Django→FastAPI)  
  2) **Smart Duplicate Merge** (queue + compare + merge, score + raisons)

---

## 3) Architecture (SSOT)
- Front: Next.js PWA (cookies + CSRF)
- Backend SSOT: Django/DRF (auth, RBAC, CRUD, audit, exports)
- Service interne: FastAPI (compute: STT Whisper, OCR CIN, Routing OSRM), **jamais appelé directement par le browser**.

> Le README décrit l’architecture et les responsabilités de chaque couche. (source: README) 

---

## 4) Acteurs & rôles (RBAC)
- **agent**: familles assignées/créées, visites, urgences (sur son périmètre)
- **admin**: accès complet + dashboard + exports + assignation + merge doublons + pilotage

---

## 5) Navigation (routes V1)
### Auth
- `/login` — email/password + passkey (WebAuthn) (all)

### Agent (mobile)
- `/app` — **Map/List single-screen** + bottom sheet famille + quick actions + Create Family FAB
- `/app/new-visit` — wizard visite (3 étapes)

### Admin
- `/app/admin` — dashboard + sections  
- `/app/admin?section=planner` — **Mission Planner**
- `/app/admin?section=duplicates` — **Duplicate Merge**

> Table des routes complète dans README. (source: README)

---

## 6) UX détaillée — Agent Mobile (V1)
### 6.1 Home `/app` (surface unique)
**Header:** Segmented control `[Carte] [Liste]` (grosses cibles tactiles)  
**Carte:** pins + cues de priorité; **Liste:** même tri et mêmes items; tap item = même sheet.

### 6.2 Family Bottom Sheet (mobile)
Contenu:
- Identité famille (nom/zone/priorité)
- “At a glance”: membres, dernière visite, badges
- Historique visites (scroll)
Actions rapides:
- **Call** → `tel:`  
- **Navigate** → Google Maps directions  
- **Add Visit** → ouvre le wizard visite  
- **Edit Family** (si présent)  
- **Attachments** (si présent)

### 6.3 Create Family (modal/sheet)
- **Essentiel**: nom/alias, téléphone, zone, GPS (auto + ajuster)
- **Optionnel** (collapsible): CIN, adresse détaillée, notes, tags vulnérabilité

### 6.4 Visits
- Utilise le wizard `/app/new-visit` (V1).  
- Objectif: conserver **retour en 1 tap** vers `/app`.

---

## 7) Admin WOW Modules (V1)
### 7.1 Mission Planner (`?section=planner`)
Objectif: planification tournée “wow visuel” + export.
Flow:
1) Filtrer (priorité / zone / date range)
2) Sélection (checkboxes)
3) Compute route (OSRM via Django→FastAPI)
4) Résultat: stops ordonnés, distance totale (km), durée (min)
5) Export plan (clipboard)
6) Assign to agent (bulk) si endpoint dispo

### 7.2 Smart Duplicate Merge (`?section=duplicates`)
Objectif: qualité data “wow crédible”.
Flow:
1) Queue des doublons suspects (depuis dashboard API)
2) Compare side-by-side (diff champs)
3) Merge (choisir target) → transfert visits/complaints/cards + audit
4) Ignore (faux positif)

---

## 8) API — périmètre sprint
### Auth/CSRF
- `GET /api/auth/csrf/`
- `POST /api/auth/login/`
- `GET /api/auth/me/`

### Agent
- `GET /api/families/`
- `POST /api/families/`
- `GET /api/visits/?family_id=...`

### Admin
- `GET /api/dashboard/` (inclut suspected_duplicates)
- `POST /api/families/{id}/assign/`
- `POST /api/families/{id}/merge/`
- `POST /api/routing/compute/`
- `GET /api/auth/users/`

> Les endpoints et contrats sont décrits dans README + API_CONTRACT.md. (source: README)

---

## 9) Accessibilité (WCAG 2.2) — V1
- Cibles tactiles ≥ `--touch-target-min` (48px)
- Focus visible (ring 2–3px)
- Non-color-only (badges icon+texte+shape)
- Modal focus-trap + return-focus
- i18n FR/AR/TN + RTL safe
- 6 toggles d’accessibilité (Easy Read / Large / XL / High Contrast / One-hand / Interview + TTS)

> Checklist détaillée dans README. (source: README)

---

## 10) i18n (V1)
- `fr` LTR, `ar` RTL, `tn` RTL
- 250+ keys par locale
- **Zéro texte hardcodé** (toutes les chaînes via `t("key")`)

---

## 11) Offline & PWA (V1)
- Manifest + service worker + page `/offline`
- Cache IndexedDB + outbox mutations (si activé)
- Indicateur pending sync

---

## 12) LAN / Real-device testing (critique jury)
Objectif: ouvrir sur iPhone/Android via IP LAN et valider login + flows.
- Next bind `0.0.0.0`
- Django bind `0.0.0.0`
- `.env` Django: `CORS_ALLOWED_ORIGINS` + `CSRF_TRUSTED_ORIGINS` incluent `http://<LAN_IP>:3000`
- `apps/web/.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://<LAN_IP>:8000`

**Note WebAuthn:** passkeys requièrent HTTPS/localhost → sur LAN HTTP, utiliser email/password.

> Procédure complète + checklist 13 points dans README/LAN_TESTING.md. (source: README)

---

## 13) Testing (DoD sprint)
### Playwright E2E
- `e2e/auth.spec.ts` (auth, session, CSRF, RBAC)
- `e2e/sprint-smoke.spec.ts` (agent map/list + sheet + create family; admin planner + duplicates)

### Build verification
- `npx next build` (Turbopack)

### Manual checklist devices
- iPhone Safari
- Android Chrome
- Desktop admin keyboard-only

---

## 14) Definition of Done (Sprint)
- iPhone Safari atteint `http://<LAN_IP>:3000`, login OK, families list OK (cookies + CSRF).
- Agent `/app`: Map/List toggle OK; tap famille → sheet; Create Family en modal/sheet; Add Visit sans friction.
- Admin: Mission Planner + Duplicate Merge utilisables et “démo clean”.
- ≥ 1 smoke test Playwright passe + build passe.
- README + LAN_TESTING + DEMO_SCRIPT à jour.

---

## 15) Non-goals (hors sprint)
- Self-host OSRM (production)
- Polylines route sur map (si non fait)
- Drag-to-reorder stops (future)
- Automatisation complète offline outbox (si pas déjà stable)
- AI Ops Brief (LLM) — **sprint séparé**.

---

## 16) Risques & mitigations
- **CORS/CSRF sur LAN** → checklist + env explicites
- **Passkeys LAN** → email/password en demo
- **OSRM demo server** → fallback mock + expliquer limitation
- **Flaky e2e** → tests ciblés + waits robustes + seed data

---

## 17) Fichiers à conserver comme “vérité”
- `README.md` (spec exécutable)
- `LAN_TESTING.md`
- `DEMO_SCRIPT.md`
- `apps/api/API_CONTRACT.md`
- `SOT/SOT-FINAL.md` (ce document)

FIN
