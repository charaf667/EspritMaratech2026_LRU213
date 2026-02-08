# Jury Demo Script — OMNIA Charity Tracking (60 seconds)

## Setup
- Desktop: `http://localhost:3000` (Chrome/Firefox)
- Phone: `http://<LAN_IP>:3000` (Safari/Chrome)
- Credentials: `admin@omnia.org` / `dev12345` (admin) | `sara@omnia.org` / `dev12345` (agent)

---

## Demo Flow (60s)

### 1. Agent Mobile UX (25s) — on phone
> "The field agent opens the app on their phone."

1. **Login** as `sara@omnia.org` → redirects to agent home
2. **Toggle Map/List** — tap "Carte" then "Liste" (segmented control)
3. **Tap a family** → bottom sheet slides up with:
   - Quick actions: **Call**, **Navigate** (Google Maps), **Add Visit**
   - Family stats: members, last visit, zone
   - Visit history
4. **Tap "Add Visit"** → visit wizard opens (3 steps)
5. **Go back**, tap **"+ Famille"** → create family modal with geolocation

> "Everything is single-screen — no deep navigation. Works offline too."

### 2. Admin Dashboard (15s) — on desktop
> "The coordinator logs in on desktop."

6. **Login** as `admin@omnia.org` → admin dashboard
7. **Show KPIs**: overdue, urgent, visits this week, new families
8. **Show sidebar**: 7 sections (Dashboard, Families, Users, Complaints, Emergencies, **Missions**, **Duplicates**)

### 3. Mission Planner (10s) — on desktop
> "The coordinator plans tomorrow's route."

9. **Click "Missions"** in sidebar
10. **Filter** by priority "Urgent" or zone
11. **Select 4-5 families** with checkboxes → click **"Calculer le trajet"**
12. **Show result**: ordered stops with distance + duration
13. **Click "Exporter"** → plan copied to clipboard
14. **Click "Assigner"** → assign to an agent

### 4. Duplicate Merge (10s) — on desktop
> "The system detected two similar families."

15. **Click "Doublons"** in sidebar
16. **Show queue** with similarity scores (87%, 92%)
17. **Click "Comparer"** → side-by-side table highlights differences
18. **Click "Cible: Ben Ali"** → families merged, visits transferred

> "The merge is safe — visits, complaints, and cards are all transferred."

---

## Key Talking Points
- **Accessibility**: 6 toggles (Easy Read, Large Text, High Contrast, One-Hand, Interview Mode, TTS) — WCAG 2.2
- **i18n**: French, Arabic, Tunisian Arabic with RTL support
- **Offline-first**: Works without network, syncs when back online
- **Real-device tested**: iPhone Safari + Android Chrome via LAN

## Manual Device Checklist

| Device | Browser | Login | Map/List | Bottom Sheet | Create Family | Admin | A11y |
|--------|---------|-------|----------|-------------|---------------|-------|------|
| iPhone 14 | Safari | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Android (emulator) | Chrome | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Desktop | Chrome | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Desktop | Firefox | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Desktop (keyboard-only) | Chrome | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
