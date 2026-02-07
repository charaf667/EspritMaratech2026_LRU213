# SOT-04 — Interaction Rules & Accessibility Enhancements (LOCK V1)

**Design baseline:** “Design‑1” (screenshots + SOT‑01/02/03).  
**Actors (LOCK):** Agent terrain (mobile) + Coordinateur/Admin.  
**Beneficiaries:** not system actors; accessibility features support agent↔bénéficiaire during visits.

## Enhancements LOCKED for V1 (Top 6)
1) Lecture Facile (Easy Read) mode  
2) Large/XL Text + Increased Spacing  
3) High Contrast + Color‑blind safe status encoding (non‑color‑only)  
4) One‑hand mode (bottom reachable actions)  
5) Interview Mode (1 question / screen)  
6) TTS “Lire à voix haute” (beneficiary-facing)

All six must be available without adding new actors/accounts.

---

## 1) Global settings entry points (UI)
### 1.1 Agent quick toggles (required)
Add an “Accessibilité” control (icon + label, not icon-only) accessible from:
- Agent Accueil header area (or overflow menu)
- Wizard header area

Toggles (persist locally per-device):
- Easy Read: On/Off
- Text Size: Normal / Large / XL
- Contrast: Default / High Contrast
- One‑hand: On/Off
- Interview Mode: On/Off (Wizard only)
- TTS: On/Off (only when Interview Mode is On)

### 1.2 Admin (recommended)
Admin should have at least:
- Text Size
- High Contrast
- Easy Read (optional but recommended)

---

## 2) Enhancement specs (exact behavior)

### 2.1 Lecture Facile (Easy Read) — LOCK
When enabled:
- Reduce secondary text density (hide non-critical metadata by default)
- Use short, predefined strings (no new copy invented)
- Keep mandatory info: status badge + primary identifiers

Applied to:
- Agent Accueil cards/list headers
- Wizard step headings + validation messages
- Admin KPI/queue labels (optional)

### 2.2 Large/XL Text + Spacing — LOCK
- Text size scale: Normal / Large (+1) / XL (+2)
- Increase line-height and padding
- Layout must wrap; no critical truncation
- Touch targets must remain ≥ 48px

Applied to: whole app (Agent + Admin)

### 2.3 High Contrast + non‑color‑only encoding — LOCK
Status must always include: icon + text + shape/border difference.
High Contrast mode increases:
- badge readability
- secondary text readability
- focus ring visibility
Charts must have labels (not hue-only).

### 2.4 One‑hand mode — LOCK
On mobile:
- Primary actions pinned to bottom safe-area:
  - Agent Accueil: “Nouvelle visite”
  - Wizard: Back / Next / Save
- Do not block inputs; respect safe-area insets.

### 2.5 Interview Mode (1 question / screen) — LOCK
Only inside Visit Wizard (Step 2/3):
- One question per screen
- Large answer controls (chips/buttons)
- Same underlying data as standard wizard:
  - aids + qty, notes (optional), attachments, complaint entry
- Can be toggled off anytime; data persists.

### 2.6 TTS “Lire à voix haute” — LOCK
Only when Interview Mode is On:
- “Lire” button per question (not icon-only)
- Use browser-native TTS (no external services)
- Stop/interrupt button
- Graceful fallback message if unsupported
- No audio stored.

---

## 3) Must integrate with existing Design‑1 blocks
- STT push-to-talk remains for agent notes; works with all modes.
- Attachments remain available in standard + interview flows.

---

## 4) Acceptance criteria
- Enhancements are discoverable and persist locally
- Toggles apply instantly without reload
- No redesign: Design‑1 layout remains intact
- Tokens only (no hardcoded colors)
