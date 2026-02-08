# AI Ops Brief — Manual Test Checklist

## Prerequisites

- [ ] Ollama installed and running: `curl http://127.0.0.1:11434/api/tags`
- [ ] Model pulled: `ollama pull qwen2.5-14b-instruct-iq4_xs:latest`
- [ ] Django running on port 8000: `python manage.py runserver`
- [ ] FastAPI running on port 8001: `uvicorn main:app --port 8001`
- [ ] Next.js running on port 3000: `npm run dev`
- [ ] `NEXT_PUBLIC_USE_API=true` in `.env.local`
- [ ] Seed data loaded: `python manage.py seed_data`

---

## 1. Backend — Django Input Endpoint

- [ ] **GET /api/admin/ops-brief-input/?window=24h&lang=fr**
  - Returns 200 with JSON containing `meta`, `kpis`, `top_overdue`, `top_urgent`, `open_complaints`, `suspected_duplicates`, `workload_by_agent`
  - `meta.window_hours` = 24
  - `meta.lang` = "fr"
  - All list items have `id`, `label`, `priority`, `target_url`, `evidence`, `timestamp`
- [ ] **Non-admin user gets 403**
- [ ] **Unauthenticated user gets 403**
- [ ] **Invalid lang defaults to "fr"**: `?lang=xx` → `meta.lang` = "fr"

## 2. Backend — Django Generate Endpoint

- [ ] **POST /api/admin/ops-brief-generate/** with `{"window_hours": 24, "lang": "fr"}`
  - Returns 200 with `success`, `output`, `fallback`, `error`, `timing_ms`
  - `output` contains `meta`, `summary`, `sections`, `actions`, `alerts`
- [ ] **Ollama running**: `fallback` = false, `output.meta.model` ≠ "deterministic-fallback"
- [ ] **Ollama stopped**: `fallback` = true, `output.meta.model` = "deterministic-fallback"
- [ ] **Non-admin user gets 403**
- [ ] **OPS_BRIEF_ENABLED=false** → returns 503

## 3. Backend — FastAPI LLM Endpoint

- [ ] **POST /v1/ops/brief/generate** (with X-Internal-Token header)
  - Returns 200 with `success: true`, `output` matching JSON schema
  - All citations in output reference IDs from the input payload or "data_missing"
- [ ] **Invalid token → 403**
- [ ] **Invalid input → appropriate error**
- [ ] **Ollama down → 502 with error detail**

## 4. Schema Validation

- [ ] Output matches `apps/svc/schemas/ops_brief.schema.json`
- [ ] `meta` has `generated_at`, `window_hours`, `lang`, `model`
- [ ] `summary` is non-empty string
- [ ] Each section bullet has `text`, `severity` ∈ {critical, warning, info}, `citations`
- [ ] Each action has `title`, `why`, `priority` ∈ [1..5], `target_url`, `citations`
- [ ] Each alert has `level` ∈ {critical, warning, info}, `message`, `citations`
- [ ] No additional properties in any object

## 5. Grounding Check

- [ ] All citations in sections/actions/alerts reference IDs from the input
- [ ] "data_missing" is accepted as a valid citation
- [ ] Unknown citation IDs are rejected (retry or fallback)

## 6. Frontend — UI (Mock Mode)

- [ ] Navigate to `/app/admin?section=ops-brief`
- [ ] **Empty state**: Brain icon + "Aucun briefing généré" message visible
- [ ] **Generate button**: Click → spinner + "Génération en cours…"
- [ ] **After generation**:
  - Summary card displayed
  - Alerts section with severity-colored borders
  - Actions list with priority numbers and deep links
  - Sections with severity badges on bullets
  - Citation tags visible on items
  - "Généré par IA — vérifiez les sources" banner shown
  - Meta bar shows model, window, generated_at, timing
- [ ] **Regenerate**: Button changes to "Régénérer" with refresh icon
- [ ] **Deep links**: Clicking action links navigates to correct admin section

## 7. Frontend — UI (API Mode)

- [ ] Same as §6 but with real backend data
- [ ] Fallback mode shows "Briefing déterministe (IA indisponible)" banner
- [ ] Error state shows red error banner with message

## 8. Sidebar Navigation

- [ ] "Brief IA" item visible in admin sidebar (Brain icon)
- [ ] Clicking navigates to `?section=ops-brief`
- [ ] Active state highlighted when on ops-brief section
- [ ] Collapsed sidebar shows Brain icon with tooltip

## 9. i18n

- [ ] Switch to AR locale → all ops-brief strings in Arabic
- [ ] Switch to TN locale → all ops-brief strings in Tunisian Arabic
- [ ] No untranslated strings visible

## 10. Accessibility

- [ ] Keyboard navigation: Tab through Generate button, action links
- [ ] Focus visible on all interactive elements
- [ ] Screen reader: button labels, section headings, alert roles
- [ ] No color-only meaning (severity uses icon + text + color)

## 11. Edge Cases

- [ ] **No seed data** (empty DB): brief generates with empty sections, "Données insuffisantes" or similar
- [ ] **Ollama timeout**: Falls back to deterministic brief within timeout
- [ ] **Rapid clicks**: Multiple generate clicks don't stack requests (button disabled during loading)
- [ ] **Very long LLM output**: UI handles gracefully without overflow

## 12. Automated Tests

```bash
# Run schema validation + grounding tests (15 tests)
cd apps/svc
python -m pytest tests/test_ops_brief.py -v
```

- [ ] All 15 tests pass
- [ ] Tests cover: valid output, missing fields, invalid severity, priority range, additional properties, grounding check, data_missing, prompt building

---

## Performance

- [ ] Full AI brief generated in < 120 seconds (Ollama model dependent)
- [ ] Deterministic fallback generated in < 1 second
- [ ] Frontend renders brief instantly after API response
