# SOT-03 — Component Inventory & Reuse Rules (Design-1 Lock)

## 0) Source of truth
- `components.zip` (UI library + OMNIA DS components)
- This inventory is used to prevent re-inventing components.

## 1) Folder semantics
- `ui/*` = base primitives (shadcn-style)
- `ds/*` = OMNIA design-system wrappers/pattern components
- `figma/*` = Figma-export utilities (e.g., ImageWithFallback)

## 2) Inventory (from `components.zip`)
### OMNIA DS components (`components/ds`)
- `ds/AttachmentChip.tsx`
- `ds/Badge.tsx`
- `ds/Button.tsx`
- `ds/Card.tsx`
- `ds/Chip.tsx`
- `ds/EmptyState.tsx`
- `ds/FormControls.tsx`
- `ds/Input.tsx`
- `ds/MapListLayout.tsx`
- `ds/Modal.tsx`
- `ds/ProgressIndicator.tsx`
- `ds/PushToTalk.tsx`
- `ds/Skeleton.tsx`
- `ds/Stepper.tsx`
- `ds/TabsNav.tsx`
- `ds/Toast.tsx`

### UI primitives (`components/ui`)
- `ui/accordion.tsx`
- `ui/alert-dialog.tsx`
- `ui/alert.tsx`
- `ui/aspect-ratio.tsx`
- `ui/avatar.tsx`
- `ui/badge.tsx`
- `ui/breadcrumb.tsx`
- `ui/button.tsx`
- `ui/calendar.tsx`
- `ui/card.tsx`
- `ui/carousel.tsx`
- `ui/chart.tsx`
- `ui/checkbox.tsx`
- `ui/collapsible.tsx`
- `ui/command.tsx`
- `ui/context-menu.tsx`
- `ui/dialog.tsx`
- `ui/drawer.tsx`
- `ui/dropdown-menu.tsx`
- `ui/form.tsx`
- `ui/hover-card.tsx`
- `ui/input-otp.tsx`
- `ui/input.tsx`
- `ui/label.tsx`
- `ui/menubar.tsx`
- `ui/navigation-menu.tsx`
- `ui/pagination.tsx`
- `ui/popover.tsx`
- `ui/progress.tsx`
- `ui/radio-group.tsx`
- `ui/resizable.tsx`
- `ui/scroll-area.tsx`
- `ui/select.tsx`
- `ui/separator.tsx`
- `ui/sheet.tsx`
- `ui/sidebar.tsx`
- `ui/skeleton.tsx`
- `ui/slider.tsx`
- `ui/sonner.tsx`
- `ui/switch.tsx`
- `ui/table.tsx`
- `ui/tabs.tsx`
- `ui/textarea.tsx`
- `ui/toggle-group.tsx`
- `ui/toggle.tsx`
- `ui/tooltip.tsx`
- `ui/use-mobile.ts`
- `ui/utils.ts`
… (full list in zip)

### Figma utilities
- `figma/ImageWithFallback.tsx`

## 3) Reuse rules (must follow)
- Prefer `ds/*` for: Buttons, Inputs, Chips, Badges, Cards, Tabs, Modals, Toasts, Skeletons, EmptyState, AttachmentChip, PushToTalk, ProgressIndicator, MapListLayout.
- Use `ui/*` only when there is no DS wrapper or when composing DS components internally.
- Do not create parallel variants of existing DS components (avoid design drift).

## 4) Screen-to-component mapping (expected)
- Header tabs → `ds/TabsNav`
- KPI cards → `ds/Card` (+ `ds/Badge` for status)
- Filter chips → `ds/Chip`
- Family cards → `ds/Card` layout with badge + chevron
- Wizard stepper → `ds/ProgressIndicator`
- Aid quantity control → `ds/Stepper`
- Attachments → `ds/AttachmentChip`
- STT → `ds/PushToTalk`
- Loading → `ds/Skeleton`
- Empty state → `ds/EmptyState`
- Map/List layout → `ds/MapListLayout`
