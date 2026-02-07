# OMNIA CHARITY TRACKING — Backlog Jira (V1 LOCKÉE) — v2 CORRECT
**Format**: Epics → User Stories → Tasks (prêt à recopier dans Jira)  
**Règle**: ne pas ajouter de scope hors PRD V1.

---

## EPIC-00 — Repo, Setup, Déploiement Self‑Host (Docker)
**Objectif**: exécuter tout localement sur PC + seed demo.

### STORY-00.1 — Initialiser repo OSS
**AC**
- Licence MIT ajoutée
- README run local
- Conventions lint/format
**Tasks**
- Créer structure monorepo ou séparé (front/api)
- Ajouter CI minimale (lint + tests)

### STORY-00.2 — Docker Compose “one command run”
**AC**
- `docker compose up` lance API + DB (+ STT service si séparé)
- Volumes persistants
**Tasks**
- Écrire `docker-compose.yml`
- Variables env + `.env.example`

### STORY-00.3 — Seed de démo
**AC**
- 10–30 familles + visites + urgences/retards + tours (option)
**Tasks**
- Script seed DB
- Données FR/AR de test

---

## EPIC-01 — Auth & RBAC (2 rôles, Option A)
**Objectif**: sécuriser accès (agent/admin) et appliquer “créé/assigné”.

### STORY-01.1 — Auth login/logout
**AC**
- Login fonctionnel
- Session sécurisée (cookie httpOnly recommandé)
**Tasks**
- Écran login (FR/AR)
- Endpoint login/logout

### STORY-01.2 — RBAC Option A appliqué partout
**AC**
- Agent: accès lecture/écriture uniquement sur familles créées/assignées
- Admin: accès global
**Tasks**
- Middleware RBAC API
- Tests d’accès (deny-by-default)

### STORY-01.3 — Gestion utilisateurs (admin)
**AC**
- Admin peut créer agent/admin
- Admin peut activer/désactiver
**Tasks**
- UI admin utilisateurs
- Endpoints users CRUD minimal

---

## EPIC-02 — Familles (CRUD + géoloc + assignation + accessibilité + OCR)
### STORY-02.1 — Créer fiche famille (mobile-first)
**AC**
- Création < 60s
- Géoloc: placer sur carte OU position actuelle
**Tasks**
- Form famille + validation
- Persist DB + audit minimal

### STORY-02.2 — Consulter/éditer famille (selon RBAC)
**AC**
- Fiche famille affiche: infos + priorité + historique (placeholder si vide)
**Tasks**
- Page détail famille
- Endpoint GET/PATCH

### STORY-02.3 — Assignation famille à un agent (admin)
**AC**
- Admin assigne/réassigne
- Agent voit “mes familles”
**Tasks**
- UI assignation
- Endpoint assign

### STORY-02.4 — Champs accessibilité (déclaré/vérifié) — optionnels
**AC**
- Champs: has_accessibility_need + accessibility_types + accessibility_verification (+ verified_by/verified_at si verified)
- Ne bloque jamais la saisie
**Tasks**
- Ajouter colonnes DB
- UI tags + statut + “vérifié par/le”

### STORY-02.5 — OCR CIN optionnel (client-side) — sans upload
**AC**
- Image non envoyée au backend
- Champs extraits remplissent le formulaire
- Flag `ocr_used=true` sauvegardé
**Tasks**
- UI “Scanner CIN”
- Implémenter OCR navigateur (lib OSS) + effacement image

---

## EPIC-03 — Visites (Wizard 3 étapes) + Aides/Besoins + Preuves
### STORY-03.1 — Wizard Nouvelle visite (3 étapes)
**AC**
- Étape 1: contexte + motif
- Étape 2: aides/besoins (chips/qty) + notes + STT + preuves (option)
- Étape 3: résumé + next_due_at + générer QR
**Tasks**
- UI wizard
- Endpoint POST visit + aids

### STORY-03.2 — Catalogue aides (10 items) + quantités
**AC**
- 10 items visibles, check/chips, qty stepper
- note courte 140 chars (sur une aide)
**Tasks**
- Table `aid_types` + seed
- UI composant “AidPicker”

### STORY-03.3 — Historique des visites (timeline)
**AC**
- Timeline sur fiche famille
- Détails visite consultables
**Tasks**
- Endpoint list visits
- UI timeline

### STORY-03.4 — Recalcul priorité après visite
**AC**
- last_visit_at mis à jour
- statut Retard/Urgent/Normal recalculé
**Tasks**
- Fonction computeStatus
- Tests unitaires règles

### STORY-03.5 — Preuves terrain (attachments) sur visite (MUST)
**AC**
- Allow-list types (image/audio/pdf) + validation MIME
- Max 3 fichiers/visite
- RBAC appliqué sur accès fichiers
- Audit upload/delete
**Tasks**
- Table `attachments`
- Endpoint upload/download/delete
- Validation taille max
- UI ajout preuve (chips + progress + delete)

---

## EPIC-04 — Carte + Liste synchronisée (Clustering ON) + filtres (max 5)
### STORY-04.1 — Carte interactive + marqueurs familles
**AC**
- Affiche familles filtrées
- Marqueurs avec icône/label (pas couleur seule)
**Tasks**
- Intégrer Leaflet
- Endpoint `GET /map/families`

### STORY-04.2 — Clustering ON + performance
**AC**
- Clustering activé par défaut
- Pas de freeze à N points (chunked loading si nécessaire)
**Tasks**
- Marker clustering
- Optimiser payload (bbox, pagination)

### STORY-04.3 — Liste synchronisée (alternative accessible)
**AC**
- Liste triée Retard→Urgent→Normal
- Clic liste ↔ zoom marker
**Tasks**
- UI list panel
- Sync state map/list

### STORY-04.4 — Filtres (max 5)
**AC**
- Priorité, Type aide, Assignation, Zone, À faire aujourd’hui
**Tasks**
- UI filtres
- Filtrage côté API

---

## EPIC-05 — Dashboard (pilotage actionnable)
### STORY-05.1 — Dashboard admin widgets minimum
**AC**
- Top Retard (10) + Top Urgent (10)
- Visites 7j/30j
- Aides distribuées (top)
- Nouvelles familles 7j/30j
**Tasks**
- Endpoint `GET /dashboard/summary`
- UI dashboard

---

## EPIC-06 — Accessibilité & Communication (STT Live + Mode entretien)
### STORY-06.1 — STT Live push-to-talk (FR/AR)
**AC**
- Maintenir pour parler → transcript gros
- Confirmer/corriger/effacer
- Ajouter aux notes
**Tasks**
- UI STT
- Service STT local + endpoint `/stt/transcribe`

### STORY-06.2 — Mode entretien (face bénéficiaire)
**AC**
- UI plein écran, texte/pictos géants
- Résumé final lisible FR/AR
**Tasks**
- Écran “Interview Mode”
- Templates questions oui/non (option)

### STORY-06.3 — Check accessibilité (baseline)
**AC**
- Focus visible
- Navigation clavier sur BO
- Cibles tactiles/spacing
**Tasks**
- Audit Lighthouse + correctifs
- Checklist QA a11y

---

## EPIC-07 — Feeling Portal (Carte bénéficiaire read‑only QR + code court)
### STORY-07.1 — Générer carte bénéficiaire en fin de visite
**AC**
- Génère `code_short` + expires_at (7 jours)
- Affiche QR + code
**Tasks**
- Table `beneficiary_cards`
- UI QR + share WhatsApp/SMS

### STORY-07.2 — Redeem sécurisé (sans secret en URL)
**AC**
- POST redeem avec code court
- Session read-only pour voir la carte
**Tasks**
- Endpoint `POST /cards/redeem`
- Endpoint `GET /cards/me`

### STORY-07.3 — Page carte bénéficiaire (read-only, FR/AR)
**AC**
- Dernière visite + aides + prochaine action + appel
- Gros texte, très simple
**Tasks**
- UI page /card
- Tests read-only (aucune écriture)

### STORY-07.4 — Révocation admin
**AC**
- Admin peut révoquer une carte
**Tasks**
- Endpoint revoke
- UI admin sur fiche famille

---

## EPIC-08 — Qualité des données (SHOULD)
### STORY-08.1 — Score complétude + alertes
**AC**
- Score visible sur fiche famille
- Alerte champs critiques manquants
**Tasks**
- Fonction computeCompleteness
- UI badges/alerts

### STORY-08.2 — Suggestions anti-doublons
**AC**
- Liste “doublons probables” (nom/adresse + proximité)
**Tasks**
- Endpoint `GET /dq/duplicates`
- Heuristique similarity (sans ML)

### STORY-08.3 — Merge admin (fusion familles)
**AC**
- Fusion conserve historique visites
**Tasks**
- Endpoint `POST /dq/merge`
- UI merge + confirmation

### STORY-08.4 — Audit minimal (inclut preuves)
**AC**
- Log create/update familles/visites/aides + upload/delete attachments
**Tasks**
- Table audit_log
- Middleware audit

---

## EPIC-09 — Offline partiel (SHOULD)
### STORY-09.1 — PWA cache (assets + pages clés)
**AC**
- App démarre sans réseau (écrans déjà visités)
**Tasks**
- Service worker
- Stratégies cache

### STORY-09.2 — Outbox queue (IndexedDB) + resync
**AC**
- Créer visite offline → statut pending → resync au retour réseau
**Tasks**
- Module outbox
- Retry/backoff simple

### STORY-09.3 — Conflits V1 (LWW + audit)
**AC**
- Conflit géré sans casser l’app
**Tasks**
- Stratégie last-write-wins
- Logger conflits

---

## EPIC-10 — Réclamations (Signalement Agent → Admin) (SHOULD)
### STORY-10.1 — Créer une réclamation depuis une famille (agent)
**AC**
- Réclamation liée à une famille (visit_id optionnel)
- Champs: category, message, priority, status (open/in_progress/resolved/closed)
**Tasks**
- Table `complaints`
- UI “Créer réclamation”

### STORY-10.2 — Liste + filtres réclamations (admin)
**AC**
- Filtrer par statut/priorité/agent
**Tasks**
- Endpoint list
- UI BO liste

### STORY-10.3 — Détail + réponse admin + changement statut
**AC**
- Admin peut répondre et changer statut
**Tasks**
- Modèle réponse (champ ou table messages) — à choisir en implémentation
- UI détail

### STORY-10.4 — Pièces jointes sur réclamation (option)
**AC**
- 0–2 pièces max (mêmes règles allow‑list)
**Tasks**
- Lier attachments aux réclamations
- RBAC et audit

---

## Références (pour structuration Jira / agile)
- Jira hierarchy Epic/Story: https://www.atlassian.com/agile/project-management/epics-stories-themes
- Scrum Guide: https://scrumguides.org/scrum-guide.html
