# OMNIA — "Uber/Google Maps" Map UX Spec (Agent `/app`)

> **Status**: Dev-ready spec — SOT-compliant optimization (not redesign)
> **Scope**: Agent `/app` Map/List experience only. Admin modules untouched.

---

## 1) Locked Requirements for `/app`

### Sources used

| Source | Sections cited |
|--------|---------------|
| `SOT/SOT_final.md` | §2 (UX non-négociables), §5 (Navigation), §6 (UX détaillée agent), §9 (Accessibilité), §10 (i18n), §11 (Offline) |
| `SOT/PRD_…_CORRECT.md` | §5 (Principes UX), §6 (Grammaire visuelle), §8.4 (Carte+Liste LOCK), §8.1 (Familles) |
| `globals.css` | SOT-02 tokens (spacing, elevation, touch targets, z-index, radius, transitions), SOT-04 a11y CSS (6 enhancements) |
| `src/components/ds/index.ts` | DS component inventory |
| `src/app/app/page.tsx` | Current AgentHomePage + FamilyDetail implementation |
| `src/components/ds/MapListLayout.tsx` | Current mobile toggle + desktop split layout |

> **Note**: `SOT-01_UI_GRAMMAR.md`, `SOT-03_COMPONENTS.md`, and `VISUAL_GUIDE.md` do **not exist** as separate files. Their content is embedded in `globals.css` (tokens), `src/components/ds/` (components), and the PRD §6 (visual grammar). All references below come from the files that do exist.

### Locked layout rules (DO NOT CHANGE)

- **Single-screen**: `/app` is the home surface — no deep navigation for frequent actions *(SOT_final §2)*
- **Map/List toggle**: segmented control at top, synced *(SOT_final §6.1)*
- **Tap family → bottom sheet (mobile) / side panel (desktop)** with quick actions *(SOT_final §6.2)*
- **Create Family**: modal/sheet (essential fields first, optional collapsible) *(SOT_final §6.3)*
- **Add Visit**: navigates to `/app/new-visit` wizard, return in 1 tap *(SOT_final §6.4)*
- **Priority order**: Overdue → Urgent → Normal, never color-only *(PRD §6.1)*
- **Clustering ON** for performance *(PRD §8.4)*
- **List sorted**: Overdue → Urgent → Normal, then by last visit age *(PRD §8.4)*
- **Max 5 filters**: Priority, Aid type, Assignment, Zone, Today *(PRD §8.4)*
- **Tokens locked**: `--touch-target-min: 48px`, `--height-tab: 48px`, all spacing/elevation/z-index *(globals.css)*
- **6 a11y toggles**: Easy Read, Large/XL, High Contrast, One-hand, Interview+TTS *(SOT_final §9, globals.css SOT-04)*
- **i18n**: `fr` LTR, `ar` RTL, `tn` RTL — zero hardcoded text *(SOT_final §10)*
- **Offline**: banner + IndexedDB cache + outbox *(SOT_final §11)*

### Locked bottom sheet content (SOT_final §6.2)

- Identity: name, zone, priority badge
- "At a glance": members, last visit, badges
- Visit history (scrollable)
- Quick actions: **Call** (`tel:`), **Navigate** (Google Maps), **Add Visit**, Edit Family (if present), Attachments (if present)

---

## 2) Proposed "Uber-like" Interaction Model

### Design philosophy

The current implementation uses a **tab-swap** pattern (List OR Map on mobile). The Uber optimization keeps the same toggle but makes the **map the persistent base layer** with content overlaid as a **draggable bottom sheet**, so the user never loses spatial context.

### Mobile (<640px) — Map-first with bottom sheet

```
┌─────────────────────────────┐
│ [≡ List]  [● Map]  toggle   │  ← segmented control (locked)
├─────────────────────────────┤
│                             │
│         MAP TILES           │  ← always rendered (even when list is "active")
│       markers/clusters      │
│                             │
│                             │
├─────────────────────────────┤
│  ░░░░ drag handle ░░░░░░░  │  ← bottom sheet
│  🔍 Search + Filter chips   │
│  ─────────────────────────  │
│  Family Card 1 (overdue)    │
│  Family Card 2 (urgent)     │
│  Family Card 3 (normal)     │
│  ...scrollable...           │
├─────────────────────────────┤
│ [+ Famille] [+ Visite]  FAB │  ← one-hand bottom actions
└─────────────────────────────┘
```

**Key changes from current implementation**:

| Aspect | Current | Proposed |
|--------|---------|----------|
| Map visibility | Hidden when "List" tab active (`display:none`) | **Always rendered**; list overlaid as bottom sheet |
| List container | Full-height column | Bottom sheet with 3 snap points |
| Tab toggle meaning | Switch between two panels | Controls bottom sheet snap: List = sheet expanded, Map = sheet collapsed to peek |
| Family detail | Full-screen overlay with backdrop | Sheet replaces list content (push transition) |
| Leaflet invalidateSize | Needed on tab switch | Not needed (map always visible) |

### Desktop/Tablet (≥640px) — Split layout (UNCHANGED)

```
┌──────────────────────────┬──────────────────────────┐
│  Search + Filters        │                          │
│  ───────────────────     │        MAP TILES         │
│  Family Card 1           │     markers/clusters     │
│  Family Card 2           │                          │
│  Family Card 3           │                          │
│  ...                     │                          │
│                          │                          │
│  [+ Famille] [+ Visite]  │                          │
├──────────────────────────┤                          │
│     (side panel if       │                          │
│      family selected)    │                          │
└──────────────────────────┴──────────────────────────┘
```

Desktop remains `w-[clamp(280px,35%,420px)]` list + flex-1 map. Family detail renders as side panel overlay (current behavior). **No changes needed for desktop.**

---

## 3) State Machine

### States

| State ID | Description |
|----------|-------------|
| `LIST_EXPANDED` | Mobile: sheet at full snap, list visible with search/filters. Map partially visible above. |
| `LIST_PEEK` | Mobile: sheet at peek snap (~120px), map dominant. Search bar visible, tap to expand. |
| `LIST_MID` | Mobile: sheet at mid snap (~50vh), balanced view. |
| `FAMILY_DETAIL` | Mobile: sheet content replaced with family detail. Map centers on family. |
| `SHEET_CLOSED` | Mobile: sheet fully collapsed (only during create-family modal or emergency). |
| `LOADING` | Skeleton cards in list; map shows cached markers or empty. |
| `EMPTY` | EmptyState component in list area. |
| `OFFLINE_BANNER` | Banner above list content. All states can have this overlaid. |
| `DESKTOP_LIST` | Desktop: list panel visible, no family selected. |
| `DESKTOP_DETAIL` | Desktop: list panel + side panel overlay with family detail. |

### Transitions

| From | Event | To | UI Changes |
|------|-------|----|------------|
| `LIST_EXPANDED` | tap "Map" toggle | `LIST_PEEK` | Sheet animates to peek; map becomes dominant |
| `LIST_PEEK` | tap "List" toggle | `LIST_EXPANDED` | Sheet animates to full |
| `LIST_PEEK` | tap search bar | `LIST_EXPANDED` | Sheet expands, keyboard opens |
| `LIST_EXPANDED` | drag sheet down | `LIST_MID` or `LIST_PEEK` | Sheet follows finger, snaps to nearest |
| `LIST_MID` | drag sheet up | `LIST_EXPANDED` | Sheet follows finger |
| `LIST_MID` | drag sheet down | `LIST_PEEK` | Sheet collapses |
| any list state | tap family card | `FAMILY_DETAIL` | Sheet content transitions to family detail; map flies to marker |
| any list state | tap map marker | `FAMILY_DETAIL` | Same as above |
| `FAMILY_DETAIL` | tap close (X) | previous list state | Sheet returns to list content |
| `FAMILY_DETAIL` | tap "Add Visit" | navigate `/app/new-visit` | Standard Next.js navigation |
| `FAMILY_DETAIL` | swipe sheet down | previous list state | Close detail |
| any state | tap FAB "+" | `SHEET_CLOSED` + Modal | Create Family modal opens |
| any state | API fetch starts | `LOADING` (overlay) | Skeleton cards appear |
| `LOADING` | API fetch completes (0 results) | `EMPTY` | EmptyState renders |
| `LOADING` | API fetch completes (>0 results) | previous list state | Cards render |
| any state | `isOnline` → false | add `OFFLINE_BANNER` | Yellow banner slides in |
| `DESKTOP_LIST` | tap family card or marker | `DESKTOP_DETAIL` | Side panel slides in |
| `DESKTOP_DETAIL` | tap close | `DESKTOP_LIST` | Side panel slides out |

---

## 4) Bottom Sheet Spec

### Snap points (mobile only)

| Snap | Height | Content visible | When used |
|------|--------|-----------------|-----------|
| **Peek** | `120px` | Drag handle + search bar (collapsed) + "N families" count | Map toggle active, or after selecting a map marker when detail is closed |
| **Mid** | `50vh` | Search + filters + ~3 family cards | Default after initial load |
| **Full** | `calc(100vh - 56px)` | Full list with scroll | List toggle active, or after dragging up |

> `56px` = height of the segmented control header.

### Drag handle

- Visual: `w-10 h-1 rounded-full bg-[var(--border-default)]` centered (already exists in FamilyDetail)
- Touch area: invisible `48px × 48px` hit zone centered on the handle
- Behavior: drag threshold 20px before committing to a snap transition

### Information architecture (family detail mode)

```
┌─────────────────────────────────┐
│  ░░░░ drag handle ░░░░░░░░░░░  │
│                                 │
│  [← Back to list]    [X Close]  │  ← back returns to list, X closes sheet to peek
│                                 │
│  Family Name       [🔴 Overdue] │  ← h2 + Badge (priority)
│  📍 Zone label                  │
│  123 Rue Example, Tunis         │  ← address (a11y-secondary)
│                                 │
│  ┌─────────┬─────────┬────────┐ │
│  │  Call    │Navigate │+ Visit │ │  ← quick actions row (48px min-h)
│  │  📞     │  🧭     │  ➕    │ │
│  └─────────┴─────────┴────────┘ │
│                                 │
│  ┌──────┬──────┬──────┐         │
│  │  5   │ 2024 │ Zone │         │  ← at-a-glance grid
│  │ memb │-12-01│ Nord │         │
│  └──────┴──────┴──────┘         │
│                                 │
│  Historique visites             │  ← h3 section header
│  ┌─────────────────────────┐    │
│  │ 2024-12-01  completed   │    │
│  │ Colis alimentaire, ...  │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ 2024-11-15  completed   │    │
│  │ Médicaments, Hygiène    │    │
│  └─────────────────────────┘    │
│  ...scrollable...               │
└─────────────────────────────────┘
```

### Quick actions specification

| Action | Icon | Label key | Handler | Disabled when |
|--------|------|-----------|---------|---------------|
| Call | `Phone` | `call` | `window.open('tel:' + phone)` | `!family.phone` |
| Navigate | `Navigation2` | `navigate` | Google Maps directions link | never |
| Add Visit | `PlusCircle` | `addVisit` | `router.push('/app/new-visit?familyId=...')` | never |
| Edit | `Edit3` | `editFamily` | opens edit modal | OPTIONAL IMPROVEMENT |
| Attachments | `Paperclip` | `attachments` | opens attachments list | OPTIONAL IMPROVEMENT |

---

## 5) Map Semantics

### Marker priority cues (NON-color-only — PRD §6.1 LOCK)

| Priority | Color | Shape | Icon | Text |
|----------|-------|-------|------|------|
| Overdue | `var(--critical)` | Circle with exclamation border (pulsing ring) | `!` inside | Badge text "Retard" |
| Urgent | `var(--warning)` | Triangle-shaped marker | `⚠` inside | Badge text "Urgent" |
| Normal | `var(--primary)` | Standard pin (default Leaflet) | none | — |

**Implementation**: Use `L.DivIcon` with inline SVG. Each marker must include `aria-label` with `"{family.name} — {t(priority)}"` for screen readers.

### Cluster behavior

| Condition | Behavior |
|-----------|----------|
| `items.length ≥ CLUSTER_THRESHOLD (150)` | Supercluster ON — circle icons with count |
| Cluster tap | Map zooms to cluster bounds |
| Cluster color | Most-critical priority in cluster: overdue > urgent > normal |
| Cluster a11y | `aria-label="{count} families, {n} overdue"` |

### List ↔ Map sync

| User action | Map behavior | List behavior |
|-------------|-------------|---------------|
| Tap list card | `map.flyTo(family.lat, family.lng, 14)` | Card highlights with `aria-current="true"` |
| Tap map marker | Map centers on marker | List scrolls to card + highlights |
| Change filter | Map re-renders visible markers | List re-filters |
| Search query | Map re-renders matching markers | List shows matching families |
| Tap cluster | Map zooms to cluster bounds | List filters to families in cluster bounds (OPTIONAL IMPROVEMENT) |

### Keyboard/focus (desktop)

- `Tab` through list items → `Enter` to select → map flies to marker
- `Escape` closes family detail panel
- Map is `tabIndex={-1}` (not in tab order — list is the keyboard-accessible alternative per PRD §5.2)

---

## 6) One-hand + Accessibility Checklist

### Thumb zone placement (mobile)

```
    ┌───────────────┐
    │   HARD ZONE   │  ← segmented control toggle (but it's just 2 buttons)
    │               │
    │   MAP AREA    │  ← passive (view only)
    │               │
    ├───────────────┤
    │  NATURAL ZONE │  ← sheet content (search, filters, cards)
    │               │
    │  EASY ZONE    │  ← quick actions, FAB buttons
    └───────────────┘
```

| Element | Position | Thumb-friendly? |
|---------|----------|----------------|
| Map/List toggle | Top center | ⚠️ Acceptable (infrequent action) |
| Search bar | Sheet top (mid snap) | ✅ When sheet is at mid |
| Filter chips | Below search | ✅ |
| Family cards | Sheet scroll area | ✅ |
| Quick actions (Call/Nav/Visit) | Inside sheet detail | ✅ |
| FAB (+ Famille, + Visite) | Fixed bottom | ✅ Perfect one-hand |
| Emergency FAB | Fixed bottom-right | ✅ |
| Close button (X) | Sheet top-right | ⚠️ Acceptable (can also swipe down) |

### One-hand mode (`a11y-one-hand` active)

When active, the CSS rule `@media (max-width: 639px) { .a11y-one-hand .a11y-bottom-actions { ... } }` pins bottom actions. **No changes needed** — the current implementation already pins FAB buttons at the bottom with `safe-area-inset-bottom`.

### WCAG 2.2 checklist for `/app`

| Criterion | Implementation | Status |
|-----------|---------------|--------|
| **2.5.8** Target Size ≥ 48px | `min-h-[var(--touch-target-min)]` on all interactive | ✅ Locked |
| **1.4.1** Non-color-only | Badge has icon+text+shape per priority | ✅ Locked |
| **2.4.7** Focus Visible | `*:focus-visible { outline: 2px solid var(--focus-ring) }` | ✅ Locked |
| **1.3.1** Info & Relationships | `role="list"`, `aria-label`, `aria-current` on list items | ✅ |
| **4.1.3** Status Messages | `aria-live="polite"` on offline banner, cluster notice | ✅ |
| **2.1.1** Keyboard | List navigable via Tab, Enter to select, Escape to close | ✅ Desktop |
| **1.4.11** Non-text Contrast | Map markers have 3:1 contrast ratio borders | Verify |
| **2.5.1** Pointer Gestures | Sheet drag has tap alternative (toggle button) | ✅ |

### RTL considerations

- Sheet slides from right on RTL (CSS `inset-inline-end`)
- Chevron icons use `rtl:rotate-180` (already implemented)
- Filter chips scroll direction follows `direction: rtl`
- Map controls (zoom) remain fixed position (Leaflet handles this)

---

## 7) Implementation Handoff

### Component inventory

| Component | Source | New? | Role |
|-----------|--------|------|------|
| `MapListLayout` | `ds/MapListLayout.tsx` | **MODIFY** | Refactor: mobile mode renders map always + bottom sheet overlay instead of tab swap |
| `BottomSheet` | new | **NEW** | Reusable draggable sheet with snap points, drag handle, transition animations |
| `MapView` | `components/MapView.tsx` | keep | Leaflet map + clustering + FlyToSelected + InvalidateSize |
| `FamilyDetail` | `app/page.tsx` (inline) | **EXTRACT** | Extract to `ds/FamilyDetailSheet.tsx` for reuse |
| `FamilyCard` | inline in `page.tsx` | **EXTRACT** (OPTIONAL) | Extract list item to standalone component |
| `EmergencyFAB` | `ds/EmergencyFAB.tsx` | keep | Floating emergency button |
| `CreateFamilyModal` | `app/page.tsx` (inline) | keep | Modal for family creation |
| `Input`, `Chip`, `Badge`, `Button`, `EmptyState`, `Skeleton` | `ds/` | keep | All DS components unchanged |

### New component: `BottomSheet`

```
Props:
  - snapPoints: number[]     // e.g. [120, '50vh', 'calc(100vh - 56px)']
  - defaultSnap: number      // index into snapPoints
  - onSnapChange: (idx) => void
  - children: ReactNode
  - dragHandle: boolean       // show/hide drag handle
  - className?: string

Behavior:
  - CSS transform + transition for smooth snapping
  - Touch: onTouchStart/Move/End for drag
  - Pointer events pass through to map when sheet is at peek
  - prefers-reduced-motion: instant snap (no animation)
  - z-index: var(--z-overlay)
```

### i18n keys to add

| Key | FR | AR | TN |
|-----|----|----|-----|
| `sheetPeekFamilies` | "{count} familles" | "{count} عائلات" | "{count} عائلات" |
| `sheetDragHint` | "Glisser pour voir la liste" | "اسحب لرؤية القائمة" | "اجبد باش تشوف اللستة" |
| `backToList` | "Retour à la liste" | "العودة إلى القائمة" | "ارجع للستة" |

> All other keys already exist in translations.ts.

### Acceptance criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | Agent on mobile `/app` | Page loads | Map renders full-screen, bottom sheet at mid snap with search + family cards |
| AC-2 | Agent sees family list | Tap "Map" toggle | Sheet animates to peek (120px), map becomes dominant |
| AC-3 | Agent sees map | Tap "List" toggle | Sheet animates to full, list scrollable |
| AC-4 | Agent sees list | Tap a family card | Sheet transitions to family detail, map flies to marker |
| AC-5 | Agent sees family detail | Tap "Add Visit" | Navigates to `/app/new-visit?familyId=X` |
| AC-6 | Agent sees family detail | Tap close or swipe down | Returns to list view at previous snap |
| AC-7 | Agent sees map | Tap a marker | Sheet shows family detail for that marker |
| AC-8 | Agent on desktop | Page loads | Split layout: list left (35%), map right (65%) — same as current |
| AC-9 | Agent offline | Page loads | Offline banner visible, cached families shown, map tiles from cache |
| AC-10 | Agent with 0 families | Page loads | EmptyState in sheet, map shows empty |
| AC-11 | Agent with RTL locale | Page loads | Sheet content, chips, text all flow RTL correctly |
| AC-12 | Agent with `a11y-one-hand` | Page loads | Bottom FAB buttons pinned with safe-area |
| AC-13 | Agent drags sheet | Drag past snap threshold | Sheet snaps to nearest snap point with spring animation |
| AC-14 | Map has >150 markers | Page loads | Clustering active, cluster icons show count + priority color |

### Test plan (Playwright smoke targets)

```typescript
// e2e/agent-map.spec.ts

test('AC-1: map + bottom sheet render on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); // iPhone
  await page.goto('/app');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('[data-testid="bottom-sheet"]')).toBeVisible();
});

test('AC-4: tap family card opens detail', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/app');
  await page.locator('[role="list"] li button').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});

test('AC-8: desktop shows split layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app');
  await expect(page.locator('[aria-label="Liste"]')).toBeVisible();
  await expect(page.locator('[aria-label="Carte"]')).toBeVisible();
});

test('AC-7: tap marker opens family detail', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/app');
  // Switch to map-dominant view
  await page.locator('button:has-text("Carte")').click();
  // Click a Leaflet marker
  await page.locator('.leaflet-marker-icon').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});
```

### Edge cases

| Edge case | Expected behavior |
|-----------|-------------------|
| **No GPS permission** | Family creation falls back to manual lat/lng input. Map still works with OSM tiles. |
| **No phone number** | "Call" quick action button is `disabled` with `opacity-40` |
| **Offline** | Yellow banner (`aria-live`), cached families from IndexedDB, mutations queue in outbox |
| **Empty list** | `EmptyState` component renders in sheet. If filters active, show "Clear filters" button. |
| **RTL locale** | All text/layout mirrors. Sheet slides from correct side. Chevrons rotate. |
| **Large/XL text** | Sheet snap points adjust — peek becomes taller to fit enlarged search bar. Cards wrap text. |
| **High contrast** | 3px focus rings, forced borders on badges/chips, markers get high-contrast outlines |
| **One-hand mode** | FAB buttons pinned bottom with `env(safe-area-inset-bottom)` |
| **Interview mode** | Elements with `.a11y-interview-hidden` are hidden in sheet |
| **prefers-reduced-motion** | Sheet snaps instantly (no spring animation) |
| **Very long family name** | Truncated with `truncate` class, full name in `aria-label` |
| **150+ families** | Clustering activates; list shows all families; map shows clusters |

---

## Summary: What changes vs. what stays

| Element | Changes? | Details |
|---------|----------|---------|
| Desktop layout | **NO** | Split layout stays identical |
| Segmented toggle | **Behavior change** | Toggles sheet snap instead of hiding panels |
| Map rendering | **YES** | Map always rendered on mobile (no more `hidden` class) |
| Bottom sheet | **NEW component** | `BottomSheet` with 3 snap points replaces tab-swap |
| Family detail | **Refactor** | Becomes a sheet content state (not full overlay) |
| List content | **Move** | From `<section>` into `BottomSheet` children |
| FAB buttons | **NO** | Stay pinned at bottom |
| Filter chips | **NO** | Stay in list header area |
| Search input | **NO** | Stays at top of list content |
| Map markers | **NO** | Same Leaflet + Supercluster |
| Quick actions | **NO** | Same Call/Nav/Visit buttons |
| Emergency FAB | **NO** | Stays as-is |
| Create Family | **NO** | Stays as Modal |
| Accessibility toggles | **NO** | All 6 stay identical |
| i18n | **+3 keys** | `sheetPeekFamilies`, `sheetDragHint`, `backToList` |
| Tokens | **NO** | Zero token changes |

**Estimated effort**: 1 new component (`BottomSheet`), 1 refactored component (`MapListLayout`), 1 extracted component (`FamilyDetailSheet`), ~3 i18n keys. No backend changes. No new npm dependencies.
