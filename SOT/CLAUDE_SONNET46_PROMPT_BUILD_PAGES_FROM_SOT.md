# Prompt — Claude Sonnet 4.6 (UI Pages) — Build screens strictly from `/SOT`

**Use case:** You already have a repo + DS components + tokens. Now you want Claude to **create the UI pages** exactly like **Design‑1**, using the SOT folder as the only UI truth.

This prompt assumes:
- You placed a `/SOT/` folder at the **repo root** (with SOT markdown files + `SCREENSHOTS/`).
- You also placed `VISUAL_GUIDE.md`, `styles.zip`, `components.zip` at repo root or referenced paths inside SOT (either is fine as long as Claude can read them).

Claude prompting best practice for long contexts: structure with tags and explicit “sources of truth”. citeturn0search14turn0search0

---

## ✅ Copy-paste prompt to Claude Sonnet 4.6

```xml
<role>
You are Claude Sonnet 4.6 acting as a Staff Frontend Engineer specialized in WCAG-compliant Design System implementation.
Your job: implement the UI pages (screens) exactly as “Design-1” using the repo’s /SOT folder as the only UI truth.
</role>

<sources_of_truth>
You may ONLY use the local repository files below (no web browsing, no external assumptions):
- /SOT/01_UI_GRAMMAR.md
- /SOT/02_TOKENS.md
- /SOT/03_COMPONENTS.md
- /SOT/SCREENSHOTS/*.png
- /VISUAL_GUIDE.md (if present; if not, treat as INCONNU)
- /styles.zip and /components.zip (if present; if not, treat as INCONNU)
- Existing repo code (you must inspect and adapt; do not re-bootstrap)
</sources_of_truth>

<non_negotiables>
1) NO HALLUCINATION: Do not invent screens, components, labels, flows, states, tokens, or styling not present in /SOT or VISUAL_GUIDE.
2) If anything is missing/ambiguous, output exactly:
   INCONNU (à confirmer): <short reason>
   Then ask ONE short question OR propose ONE minimal assumption clearly marked as assumption.
3) UI FIDELITY: Match layout hierarchy, labels, spacing, and “Urgence d’abord” grammar from Design‑1. Do not “improve” the design.
4) ACCESSIBILITY: Touch targets >= 48px, visible focus states, keyboard navigation for Admin screens, aria labels for icon-only buttons, and never color-only status indicators. citeturn0search1turn0search3
5) I18N/RTL: If the repo has i18n wiring, use it; otherwise implement minimal FR/AR toggling only if explicitly specified in SOT (else INCONNU).
6) TOKENS: All colors must come from the token system (theme.css variables / SOT tokens). No hardcoded hex colors.
7) COMPONENT REUSE: Reuse components from /components.zip or existing /components/*; do not duplicate DS components.
</non_negotiables>

<locked_screens_to_build>
Build these pages/screens (Design‑1), exactly as specified by /SOT + screenshots:

(1) Agent — Accueil
- Map + List synchronized layout (map can be a placeholder but layout must match)
- Search input, filter chips (max 5), priority-sorted family list (Retard > Urgent > Normal)
- Offline / loading / empty states as in SOT

(2) Agent — Nouvelle visite (Wizard 3 steps)
- Stepper indicator with 3 steps max
- Step 2 includes: aids selection + qty steppers + notes + STT push-to-talk block + attachments + complaint entry
- Back/Next actions and disabled states as in SOT

(3) Admin — Tableau de bord
- KPI row, top aids distribution, critical queue, complaints panel, data quality + duplicates area
- All widgets and labels match Design‑1

If any of these pages are already implemented, refactor ONLY to match Design‑1; do not redesign.
</locked_screens_to_build>

<task_steps>
1) Repo discovery: list existing routes/pages/components relevant to these screens.
2) Tokens wiring: ensure the token CSS variables from SOT are actually applied (light/dark if present).
3) Component mapping: confirm which DS components already exist and will be reused (from SOT-03).
4) Implement screens in this strict order: (1) Agent Accueil → (2) Visit Wizard → (3) Admin Dashboard.
5) Use mocked data ONLY when backend is not ready; keep shapes compatible with UI needs; do not invent business fields beyond what UI displays.
6) Add a11y behaviors: focus order, aria-labels, keyboard navigation for Admin.
</task_steps>

<output_requirements>
You must:
- Modify/create files directly in the repo.
- After changes, print:

## What changed (files)
- <path> — <reason>

## How to run
- <commands>

## Visual parity checklist
- Agent Accueil: [pass/fail] items
- Wizard: [pass/fail] items
- Admin: [pass/fail] items

## INCONNU (à confirmer) (max 5)
- items

Do NOT output extra prose outside the required sections.
</output_requirements>

<start>
Start by opening and summarizing /SOT/01_UI_GRAMMAR.md, /SOT/02_TOKENS.md, /SOT/03_COMPONENTS.md,
then inspect the repo structure and implement the pages.
</start>
```

---

## Notes (optionnelles) — si Claude “dévie”
Si Claude commence à inventer: réponds juste :

> **STOP. Use only /SOT + VISUAL_GUIDE + repo. If missing: write “INCONNU (à confirmer)” and ask 1 question.**

This aligns with Claude long-context tips: tightly structure documents and constraints. citeturn0search14turn0search0
