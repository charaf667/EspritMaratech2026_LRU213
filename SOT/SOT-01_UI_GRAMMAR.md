# SOT-01 — UI Grammar & Screen Specs (Design-1 Lock)

**Project:** OMNIA Charity Tracking (web app mobile-first PWA)  
**Scope:** UI reverse-engineering “Design-1” (locked).  
**Goal:** Give an implementation AI unambiguous UI requirements to reproduce the screens *exactly* (layout, components, states, accessibility).

## 0) Source of truth (design)
Use these as authoritative references (do not invent UI):
- `VISUAL_GUIDE.md` (ASCII layouts + behavior + states)
- Screenshots (UI proof):
- `Capture d'écran 2026-02-07 033554.png`
- `Capture d'écran 2026-02-07 033614.png`
- `Capture d'écran 2026-02-07 033621.png`
- `Capture d'écran 2026-02-07 033625.png`
- `Capture d'écran 2026-02-07 033647.png`
- `Capture d'écran 2026-02-07 033652.png`
- `Capture d'écran 2026-02-07 033659.png`
- `Capture d'écran 2026-02-07 033703.png`
- `Capture d'écran 2026-02-07 033759.png`
- `Capture d'écran 2026-02-07 033808.png`

## 1) Global layout rules
- **Header:** sticky, contains brand block (O avatar + OMNIA + subtitle), right-side utilities (RTL toggle + theme toggle).
- **Primary navigation:** Tabs (3) inside header area, horizontally scrollable on narrow widths.
  - Tabs: “Agent - Accueil”, “Agent - Nouvelle visite”, “Admin - Tableau de bord”.
- **Main:** content switches by tab (no routing assumptions; implement as routes or state, but visuals must match).
- **Visual density:** outdoor/field-friendly, high contrast, large touch targets.

## 2) “Urgence d’abord” visual grammar (LOCK)
Priority order and display rules:
1. **Retard / Overdue** (Critical)  
2. **Urgent** (Warning)  
3. **Normal** (Neutral)  
**Never rely on color alone.** Always show:
- icon + text label (e.g., alert icon + “En retard / Urgent / Normal”)
- badge shape is pill/rounded and placed consistently on cards

## 3) Screen: Agent — Accueil (Map + List sync)
### Desktop / Tablet (>~640px)
- **Split layout:** left = map panel (placeholder), right = list panel.
- List panel contains:
  - Search input “Rechercher une famille…”
  - Filter chips section: max 5 visible chips (e.g., En retard, Urgent, Mes familles, Aujourd’hui, Zone Nord)
  - Scrollable list of family cards (priority-sorted: Retard → Urgent → Normal)
- **Family card contents:**
  - Title: “Famille <Name>”
  - ID line: “ID: FAM-…”
  - Badge: priority pill (e.g., “Overdue” in screenshot; keep i18n-ready)
  - Address + phone
  - Meta row: members count + last visit date
  - Right chevron indicating open/details

### Mobile (<~640px)
- **Map/List toggle** (single view at a time). Default = List.
- CTA “Nouvelle visite” is prominent and always reachable (either button at bottom or floating, per design).

### States (must exist)
- Offline banner (orange) with “Mode hors ligne…”
- Loading skeletons for list/cards
- Empty state with “Effacer les filtres”

## 4) Screen: Agent — Nouvelle visite (Wizard)
- Wizard has **3 steps max** with stepper indicator (1 Famille, 2 Bénéfices, 3 Validation).
- **Step 2 (Bénéfices)** is fully specified in the guide:
  - Aid list (checkboxes) with quantity steppers for selected items
  - Notes textarea (optional)
  - **Push-to-talk STT block** (large circular mic button)
  - Transcript panel with actions: Confirmer, Corriger, Effacer (✗)
  - Attachments section with “Ajouter” + attachment chip row
  - “Signaler un problème” collapsible card with CTA “Créer un signalement”
  - Bottom actions: Back / Cancel / Next (Next can be disabled until at least 1 aid selected)

## 5) Screen: Admin — Tableau de bord
Top-to-bottom sections:
1) KPI cards row (4 cards): En retard, Urgents, Visites (7j), Nouvelles familles (7j) + trend indicators
2) “Types d’aide les plus distribués (30j)” ranking with bars
3) “File d’action critique” list (priority-sorted) with buttons: Assigner / Planifier / Ouvrir
4) “Signalements & Plaintes” panel with filters (Statut / Priorité / Agent) and complaint cards
5) “Qualité des données” panel with:
   - global score + progress bar
   - “Doublons suspectés” count
   - duplicate cards showing similarity % + explanation + actions: Fusionner / Ignorer / Comparer
   - (Comparison view is a modal or separate panel — implement whichever matches current design components)

## 6) RTL behavior (FR/AR readiness)
- Switching `dir="rtl"` mirrors layout:
  - text aligns right
  - directional icons (chevrons, arrows) flip
  - tabs order reverses
- Numbers remain LTR; dates remain LTR format.

## 7) Accessibility non-negotiables (applied everywhere)
- Minimum touch target: **48px**
- Focus-visible rings on all interactive elements
- Keyboard navigation required for Admin areas (tabs, dropdowns, modals, tables)
- Map must have a complete list alternative for all essential actions.

## 8) “Do not change” list (hard constraints)
- Do not alter: spacing scale, typography scale, semantic colors, badge wording structure, card layout.
- Do not introduce new components unless absolutely necessary; prefer existing DS components.
