# OMNIA CHARITY TRACKING — PRD V1 (LOCKÉ) — v2 CORRECT
**Type**: Web app mobile‑first (PWA via navigateur) — **Open Source / Self‑Host**  
**Cible**: Associations caritatives (Tunisie), usage campagne/événementiel (terrain)  
**Acteurs (LOCK)**: 2 rôles système uniquement → **Agent terrain** + **Coordinateur/Admin**

---

## 0) Règle d’interprétation (anti‑ambiguïté)
**Cette PRD est la seule source de vérité fonctionnelle.**  
Si une section “ADDENDUM” contredit ou complète MoSCoW ou une autre section, **l’ADDENDUM prévaut** (car il est explicitement “LOCK”).  
Objectif: éviter toute lecture partielle / résumés incohérents.

---

## 1) Instructions d’exécution pour le Dev (IA ou humain)
- Implémenter **uniquement** le scope V1 “MUST” (et “SHOULD” seulement si stable).
- Priorités non négociables: **simplicité terrain**, **accessibilité**, **robustesse**, **self‑host**, **OSS‑first**.
- Toute ambiguïté se tranche en faveur de: (1) moins de friction UX, (2) sécurité/privacité, (3) maintenabilité, (4) performance mobile.

---

## 2) Contexte & problème
Les associations gèrent souvent le terrain via papier/Excel/WhatsApp. Il manque un système centralisé pour:
- enregistrer les **familles** (bénéficiaires)
- tracer les **visites**
- lier les **aides/interventions**
- visualiser et décider via **carte + indicateurs**

Contraintes terrain: connectivité variable, appareils low‑end, temps de saisie très court.

---

## 3) Vision V1 (LOCK)
Un outil de travail terrain permettant:
1. CRUD **Familles**
2. CRUD **Visites** (wizard rapide)
3. **Aides** via cases/chips + quantités
4. **Historique** par famille
5. **Carte + Liste synchronisée** (priorité actionnable)
6. **Dashboard** simple “pilotage actionnable”
7. **Accessibilité & Communication**: **STT live** + “mode entretien”
8. **Feeling‑Portal**: carte bénéficiaire read‑only QR/code court, **sans compte bénéficiaire**
9. **Preuves terrain optionnelles**: description texte + **pièces jointes** (audio/image/pdf)
10. **Vérification accessibilité** (déclaré/vérifié) sans stockage obligatoire de documents
11. **OCR optionnel (client-side)** pour extraire des champs (ex: CIN) sans stocker l’image
12. **Réclamations (signalement)** Agent → Admin (si stable)

---

## 4) Acteurs & RBAC (LOCK)
### Rôles
- **Agent terrain/bénévole**: saisie et suivi sur mobile.
- **Coordinateur/Admin**: pilotage, qualité data, gestion utilisateurs, supervision.

### RBAC — Option A (LOCK)
- Agent: lecture/écriture uniquement sur les familles **créées** par lui OU **assignées** à lui.
- Admin: accès global, peut assigner/réassigner, corriger, fusionner doublons, consulter audit.

---

## 5) Principes UX/UI (LOCK)
### 5.1 Saisie terrain
- Aides/Besoins: **cases à cocher / chips** + quantités (+/–).
- Notes: optionnelles (texte court) + support **STT live**.
- Parcours “Nouvelle visite”: **wizard 3 étapes** (max).
- **Pièces jointes**: ajout optionnel (image/audio/pdf) avec règles strictes (voir §10).

### 5.2 Accessibilité “réelle” (pas juste responsive)
- Cibles tactiles/espacement conformes à WCAG 2.2 **Target Size (Minimum)** (SC 2.5.8): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Auth sans “test cognitif” (WCAG 2.2 **Accessible Authentication (Minimum)**, SC 3.3.8): https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
- Focus visible, navigation clavier (admin).
- Carte opérable via alternative textuelle: **Map + Liste synchronisée**.

---

## 6) Grammaire visuelle “Actionnable” (LOCK)
### 6.1 Priorité carte (ordre strict)
1. **Retard / Overdue**
2. **Urgent**
3. **Normal**
Puis **Type d’aide** (icône/label; jamais couleur seule).

### 6.2 Définition des statuts (LOCK)
Champs nécessaires: `last_visit_at`, `next_due_at` (recommandé), `priority_override`, `urgent_reason` (optionnel).
Règles:
- **Retard** si `next_due_at` existe et `now > next_due_at`, OU si `next_due_at` null et `last_visit_at + cadence_default_days < now`.
- **Urgent** si `priority_override = urgent` OU une aide/besoin est marqué `urgent=true` (ex: médicaments critique).
- **Normal** sinon.
Paramètre: `cadence_default_days` (ex 30) configurable admin.

---

## 7) MoSCoW (V1) — CORRIGÉ (inclut ADDENDUM “LOCK”)
### MUST
1) Auth + RBAC (2 rôles, Option A)  
2) Familles (CRUD, géoloc)  
3) Visites (wizard 3 étapes) + historique  
4) Aides/Besoins (10 items max) en check/chips + quantités  
5) Carte **Map + Liste** synchronisée + **Clustering ON**  
6) Dashboard simple (indicateurs actionnables)  
7) Accessibilité & Communication: **STT live** + mode entretien  
8) Feeling‑Portal: carte bénéficiaire read‑only QR/code court, sans compte  
9) **Description + Pièces jointes sur visite** (optionnel): image/audio/pdf, max 3, allow‑list, RBAC, audit upload/delete  

### SHOULD (si stable)
- Qualité data: anti‑doublons + merge admin, complétude + alertes, audit minimal  
- Planification tournée: sélection zone/cluster → ordre “good enough” (routing)  
- Offline partiel: outbox queue + resync + statut “pending”  
- **Vérification accessibilité** (déclaré/vérifié) (sans document obligatoire)  
- **OCR CIN client‑side** (sans upload image) + flag `ocr_used=true`  
- **Réclamations (signalement)** Agent → Admin (ticketing interne minimal)  

### COULD
- Pack micro‑clips langue des signes (10–20 phrases) + sous‑titres/transcripts  
- Scan QR côté agent pour ouvrir une fiche famille  

### WON’T (V1)
- Portail bénéficiaire avec comptes/auth (3e acteur)  
- Modèles ML prédictifs (pas de dataset)  
- Modules hors CDC (paiements, gestion stock complète, etc.)

---

## 8) Spécifications fonctionnelles détaillées (V1)

### 8.1 Familles
**Champs minimum**
- Identité: `head_name`, `household_size`, `phone?`, `address_text?`
- Contexte simple: `vulnerability_tags[]?` (max 4 tags)
- Géoloc: `lat`, `lng` (obligatoire pour carte; saisie manuelle + option “position actuelle”)
- Suivi: `last_visit_at?`, `next_due_at?`, `priority_override?`
- Ownership: `created_by_user_id`, `assigned_to_user_id?`
- Audit: `created_at`, `updated_at`

**Champs accessibilité (LOCK — optionnels, structurés)**
- `has_accessibility_need` (bool)
- `accessibility_types[]` (mobility/hearing/speech/vision/cognitive/other)
- `accessibility_verification` (none/declared/verified)
- `verified_by_user_id?`, `verified_at?` (si verified)

**OCR (LOCK — optionnel)**
- Bouton “Scanner CIN (optionnel)” pour pré‑remplir des champs.
- OCR côté navigateur; **la photo n’est pas uploadée ni persistée**.
- Seuls les champs extraits sont sauvegardés + flag `ocr_used=true`.

**AC**
- Un agent peut créer une famille en < 60s sur mobile.
- RBAC appliqué (créé/assigné).
- Admin peut assigner/réassigner.
- Les champs accessibilité et OCR ne bloquent jamais la saisie.

---

### 8.2 Visites (wizard 3 étapes)
**Step 1 — Contexte**
- `visited_at` (auto), `motive` (Distribution / Suivi / Évaluation / Urgence)
- Géoloc de visite (optionnel): “position actuelle” ou “placer sur carte”

**Step 2 — Aides/Besoins + Description + Pièces jointes (LOCK)**
- Liste (10 items) check/chips
- Quantités via stepper
- `urgent` bool + `urgent_reason` (enum)
- Notes: texte court + option STT live
- **Pièces jointes (optionnel)**: image/audio/pdf, max 3, allow‑list, taille max, RBAC, audit upload/delete

**Step 3 — Résumé**
- Récap aide/notes
- `next_due_at` via quick buttons: 7j / 14j / 30j / custom
- Bouton: **Générer Carte bénéficiaire (QR)**
- Submit (online) ou queue (offline)

**AC**
- Enregistrer une visite complète sans clavier (notes optionnelles).
- Recalcul priorité Retard/Urgent/Normal après visite.
- Les pièces jointes ne sont pas obligatoires et ne bloquent jamais l’enregistrement.

---

### 8.3 Aides/Besoins (catalogue V1 recommandé)
**10 items**
1) Colis alimentaire  
2) Médicaments  
3) Hygiène  
4) Vêtements / couvertures  
5) Bébé (lait/couches)  
6) Scolaire  
7) Transport  
8) Logement (loyer/hébergement)  
9) Aide financière  
10) Aide spécifique (Autre)

**Règles**
- `notes` (sur une aide) max 140 chars.
- Médicaments: champs optionnels (nom + qty) si nécessaire; minimiser données sensibles.

---

### 8.4 Carte + Liste synchronisée (LOCK)
**Comportement**
- Carte avec marqueurs/cluster.
- Liste triée: **Retard → Urgent → Normal** (puis ancienneté).
- Clic item liste → zoom marker.
- Clic cluster → filtre/zoom + liste correspondante.

**Filtres (max 5)**
1) Priorité (Retard/Urgent/Normal)  
2) Type d’aide  
3) Assignation (Moi / Non assigné / Agent X)  
4) Zone (simple)  
5) “À faire aujourd’hui”  

**Perf**
- Clustering ON.
- Chargement progressif/optimisé si dataset important.

---

### 8.5 Dashboard (pilotage actionnable)
Widgets minimum:
- Top Retard (10) + Top Urgent (10)
- Visites (7j/30j)
- Types d’aides les plus distribuées
- Nouvelles familles (7j/30j)

---

### 8.6 Accessibilité & Communication — STT Live (MUST)
**UI**
- Push‑to‑talk “Maintenir pour parler”
- Transcript gros + boutons: Confirmer / Corriger / Effacer
- Option “ajouter aux notes”

**Tech (self‑host)**
- Service local (ex: whisper.cpp) accessible via API locale.
- Mode segmenté (3–8s) pour latence acceptable.

---

### 8.7 Feeling‑Portal (MUST) — Carte bénéficiaire read‑only
**But**
Transparence “reçu numérique” + réduire re‑demandes, adapté faible littératie numérique.

**Contenu affiché (minimisé)**
- Dernière visite (date)
- Aides + quantités
- Prochaine action (date/statut)
- Bouton: Appeler l’association

**Accès**
- QR + **code court** (fallback)
- Partage WhatsApp/SMS/copie lien (par agent/admin)

**Sécurité (LOCK)**
- Read‑only strict.
- Expiration (ex 7 jours) + révocation admin.
- Éviter secrets dans l’URL; privilégier code court + `POST /redeem` → session read‑only.
- Référence OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

---

### 8.8 Réclamations (signalement) Agent → Admin (LOCK — SHOULD)
- Un agent peut créer une réclamation liée à une **famille** (et visite optionnelle):
  - `category`, `message`, `priority`, `status` (open/in_progress/resolved/closed)
- Admin peut répondre et changer statut.
- Pièces jointes optionnelles: max 2 (mêmes règles allow‑list).

---

## 9) Qualité des données (SHOULD)
- Anti‑doublons: proximité géo + similarité nom/adresse (heuristique, sans ML)
- Merge admin: fusionner 2 familles (conserver historique)
- Complétude: score + alertes (nom, taille, géoloc)
- Audit minimal: create/update sur familles/visites/aides (+ upload/delete pièces jointes)

---

## 10) Pièces jointes (LOCK)
- Types allow‑list: **jpg/png/webp**, **webm/ogg**, **pdf**
- Max **3** pièces / visite (configurable)
- Taille max (ex 10MB/fichier)
- Stockage lié à la **visite** (pas à la famille directement)
- Accès: RBAC (agent = uniquement ses données; admin = global)
- Audit minimal: upload/delete

---

## 11) Offline partiel (SHOULD) — approche la plus simple
- PWA cache (assets + pages clés)
- Outbox queue IndexedDB: opérations CRUD “pending” → sync
- Conflits V1: “last‑write‑wins” + audit

---

## 12) Architecture technique (OSS-first) — self-host sur PC
**Livrable attendu**: `docker-compose.yml` + volumes persistants + seed démo.

### Recommandation composants
- Frontend: PWA (React/Next ou équivalent)
- API: REST JSON
- DB: PostgreSQL (+ PostGIS si besoin avancé)
- Carto: Leaflet + clustering
- STT: service local (whisper.cpp)
- Routing (si activé): OSRM
- i18n: FR + AR (RTL)

---

## 13) Démo (Definition of Done V1)
1) Login agent  
2) Carte + liste → ouvrir famille  
3) Nouvelle visite wizard → cocher aides + STT notes → **(option) ajouter 1 pièce jointe** → sauvegarder  
4) Générer QR “Carte bénéficiaire” → ouvrir page read-only FR/AR  
5) Dashboard admin (retard/urgent + stats)  
