# SOT-05 — WCAG DoD Checklist + i18n/RTL Contract (LOCK V1)

## 1) WCAG DoD (must pass)
### 1.1 Touch targets (LOCK)
All interactive elements ≥ 48px (tabs, chips, icon buttons, steppers, card rows, menu items).

### 1.2 Focus visible (LOCK)
Visible focus ring on all interactive elements. No removing outline without replacement.

### 1.3 Keyboard navigation (LOCK for Admin)
Admin dashboard, filters, modals (“Comparer doublons”), action buttons usable end-to-end by keyboard.
Modals trap focus and return focus on close.

### 1.4 Non-color-only encoding (LOCK)
Priority/urgency uses icon + text + shape. Never color-only.

### 1.5 Labels & names (LOCK)
Every input has a programmatic label.
Icon-only buttons have aria-label.
Validation errors link to fields (aria-describedby).

### 1.6 Status messages (LOCK)
Offline/loading/pending states announced with role=status / aria-live.

---

## 2) i18n FR/AR + RTL (LOCK)
- Support FR and AR for labels visible in Design‑1.
- When AR active: <html dir="rtl" lang="ar">, layout mirrors, directional icons flip, numbers/dates remain readable.

---

## 3) Checks for the 6 enhancements (from SOT‑04)
Easy Read: toggle exists, shorter copy, status retained.  
Large/XL: wraps, no critical truncation, touch targets preserved.  
High Contrast: badges/secondary text readable; charts labeled.  
One-hand: primary actions in bottom safe-area; no blocked inputs.  
Interview Mode: 1 question per screen; data parity with wizard.  
TTS: Lire + Stop; graceful fallback; no storage.

---

## 4) Manual test checklist (minimum)
- Keyboard-only Admin: dashboard → duplicates compare → close modal
- Mobile one-hand: create visit with Interview Mode + attachments + STT notes
- Switch FR↔AR: verify RTL mirroring + icon direction
- Enable High Contrast + XL text: verify list/card readability
