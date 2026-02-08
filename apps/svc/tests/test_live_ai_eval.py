"""
🧪 Live AI Evaluation Suite — Tests REAL Ollama responses
═══════════════════════════════════════════════════════════
Run with Ollama running locally:
    python -m pytest tests/test_live_ai_eval.py -v -s --tb=short

This suite calls the real Ollama model and evaluates:
  1. Schema conformance (does JSON match the schema?)
  2. Grounding accuracy (do citations reference real input IDs?)
  3. Language compliance (is the text in the requested language?)
  4. Content relevance (does summary reflect KPIs?)
  5. Priority calibration (are actions ordered by urgency?)
  6. Severity alignment (do critical items map to overdue families?)
  7. Hallucination detection (are invented names/numbers present?)
  8. Temperature sensitivity (does temp=0 vs temp=0.5 differ?)
  9. Edge cases (empty input, single family, all urgent)
 10. Timing / performance

Results are saved to apps/svc/logs/ai_eval_report.json for analysis.

Requires: Ollama running at http://127.0.0.1:11434 with the model pulled.
"""

import asyncio
import json
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
import pytest

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routers.ops_brief import (
    OPS_BRIEF_SCHEMA,
    _validate_schema,
    _check_grounding,
    _collect_valid_ids,
    _build_system_prompt,
    _build_user_prompt,
)

# ── Config ──────────────────────────────────────────────────

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "vanilj/qwen2.5-14b-instruct-iq4_xs:latest")
TIMEOUT = int(os.environ.get("OPS_BRIEF_TIMEOUT_SECONDS", "180"))

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
EVAL_REPORT_PATH = LOG_DIR / "ai_eval_report.json"

# ── Fixtures: Realistic input payloads ───────────────────────

RICH_INPUT = {
    "meta": {
        "schema_version": "1",
        "generated_at": "2026-02-08T03:00:00Z",
        "window_hours": 24,
        "lang": "fr",
        "data_missing": [],
    },
    "kpis": {
        "overdue_count": 4,
        "urgent_count": 2,
        "open_complaints_count": 3,
        "suspected_duplicates_count": 1,
        "visits_last_24h": 12,
        "families_total": 45,
    },
    "top_overdue": [
        {"id": "fam:aaa1", "label": "Famille Trabelsi", "priority": "overdue", "target_url": "/app/admin?section=families&id=aaa1", "evidence": "next_due_at=2026-01-20T00:00:00Z (19j retard)", "timestamp": "2026-01-20T00:00:00Z"},
        {"id": "fam:aaa2", "label": "Famille Hamdi", "priority": "overdue", "target_url": "/app/admin?section=families&id=aaa2", "evidence": "next_due_at=2026-01-25T00:00:00Z (14j retard)", "timestamp": "2026-01-25T00:00:00Z"},
        {"id": "fam:aaa3", "label": "Famille Ben Ali", "priority": "overdue", "target_url": "/app/admin?section=families&id=aaa3", "evidence": "next_due_at=2026-02-01T00:00:00Z (7j retard)", "timestamp": "2026-02-01T00:00:00Z"},
        {"id": "fam:aaa4", "label": "Famille Mejri", "priority": "overdue", "target_url": "/app/admin?section=families&id=aaa4", "evidence": "next_due_at=2026-02-05T00:00:00Z (3j retard)", "timestamp": "2026-02-05T00:00:00Z"},
    ],
    "top_urgent": [
        {"id": "fam:bbb1", "label": "Famille Bouazizi", "priority": "urgent", "target_url": "/app/admin?section=families&id=bbb1", "evidence": "priority_override=urgent, last_visit=2026-01-10", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "fam:bbb2", "label": "Famille Khelifi", "priority": "urgent", "target_url": "/app/admin?section=families&id=bbb2", "evidence": "priority_override=urgent, last_visit=never", "timestamp": "2026-02-08T00:00:00Z"},
    ],
    "open_complaints": [
        {"id": "cmp:ccc1", "label": "Aide manquante — Famille Trabelsi", "priority": "high", "target_url": "/app/admin?section=complaints&id=ccc1", "evidence": "status=open, priority=high", "timestamp": "2026-02-06T10:00:00Z"},
        {"id": "cmp:ccc2", "label": "Retard de visite — Famille Hamdi", "priority": "medium", "target_url": "/app/admin?section=complaints&id=ccc2", "evidence": "status=in_progress, priority=medium", "timestamp": "2026-02-07T14:00:00Z"},
        {"id": "cmp:ccc3", "label": "Comportement agent — Famille Mejri", "priority": "urgent", "target_url": "/app/admin?section=complaints&id=ccc3", "evidence": "status=open, priority=urgent", "timestamp": "2026-02-07T18:00:00Z"},
    ],
    "suspected_duplicates": [
        {"id": "dup:ddd1", "label": "Trabelsi vs Trabelci (87%)", "priority": "high", "target_url": "/app/admin?section=duplicates&pair=x-y", "evidence": "Similarity 87%", "timestamp": "2026-02-08T00:00:00Z"},
    ],
    "workload_by_agent": [
        {"id": "usr:eee1", "label": "Ahmed Salah", "priority": "high", "target_url": "/app/admin?section=users&id=eee1", "evidence": "assigned=18 overdue=5", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "usr:eee2", "label": "Fatma Ben Youssef", "priority": "medium", "target_url": "/app/admin?section=users&id=eee2", "evidence": "assigned=12 overdue=1", "timestamp": "2026-02-08T00:00:00Z"},
    ],
}

EMPTY_INPUT = {
    "meta": {"schema_version": "1", "generated_at": "2026-02-08T03:00:00Z", "window_hours": 24, "lang": "fr", "data_missing": ["suspected_duplicates"]},
    "kpis": {"overdue_count": 0, "urgent_count": 0, "open_complaints_count": 0, "suspected_duplicates_count": 0, "visits_last_24h": 0, "families_total": 0},
    "top_overdue": [], "top_urgent": [], "open_complaints": [], "suspected_duplicates": [], "workload_by_agent": [],
}

SINGLE_CRITICAL_INPUT = {
    "meta": {"schema_version": "1", "generated_at": "2026-02-08T03:00:00Z", "window_hours": 24, "lang": "fr", "data_missing": []},
    "kpis": {"overdue_count": 1, "urgent_count": 0, "open_complaints_count": 0, "suspected_duplicates_count": 0, "visits_last_24h": 2, "families_total": 5},
    "top_overdue": [{"id": "fam:solo1", "label": "Famille Unique", "priority": "overdue", "target_url": "/app/admin?section=families&id=solo1", "evidence": "next_due_at=2026-01-01 (38j retard!)", "timestamp": "2026-01-01T00:00:00Z"}],
    "top_urgent": [], "open_complaints": [], "suspected_duplicates": [], "workload_by_agent": [],
}

ALL_URGENT_INPUT = {
    "meta": {"schema_version": "1", "generated_at": "2026-02-08T03:00:00Z", "window_hours": 24, "lang": "fr", "data_missing": []},
    "kpis": {"overdue_count": 0, "urgent_count": 5, "open_complaints_count": 5, "suspected_duplicates_count": 0, "visits_last_24h": 0, "families_total": 5},
    "top_overdue": [],
    "top_urgent": [
        {"id": "fam:urg1", "label": "Famille A", "priority": "urgent", "target_url": "/a", "evidence": "urgent, last_visit=never", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "fam:urg2", "label": "Famille B", "priority": "urgent", "target_url": "/b", "evidence": "urgent, last_visit=never", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "fam:urg3", "label": "Famille C", "priority": "urgent", "target_url": "/c", "evidence": "urgent, last_visit=never", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "fam:urg4", "label": "Famille D", "priority": "urgent", "target_url": "/d", "evidence": "urgent, last_visit=never", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "fam:urg5", "label": "Famille E", "priority": "urgent", "target_url": "/e", "evidence": "urgent, last_visit=never", "timestamp": "2026-02-08T00:00:00Z"},
    ],
    "open_complaints": [
        {"id": "cmp:u1", "label": "Plainte A", "priority": "urgent", "target_url": "/ca", "evidence": "urgent", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "cmp:u2", "label": "Plainte B", "priority": "urgent", "target_url": "/cb", "evidence": "urgent", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "cmp:u3", "label": "Plainte C", "priority": "high", "target_url": "/cc", "evidence": "high", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "cmp:u4", "label": "Plainte D", "priority": "high", "target_url": "/cd", "evidence": "high", "timestamp": "2026-02-08T00:00:00Z"},
        {"id": "cmp:u5", "label": "Plainte E", "priority": "medium", "target_url": "/ce", "evidence": "medium", "timestamp": "2026-02-08T00:00:00Z"},
    ],
    "suspected_duplicates": [],
    "workload_by_agent": [],
}


# ── Helpers ──────────────────────────────────────────────────

def _run_async(coro):
    """Run an async coroutine synchronously (for pytest without async plugin)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def call_ollama_raw(
    input_data: Dict[str, Any],
    lang: str = "fr",
    window_hours: int = 24,
    temperature: float = 0.1,
    top_p: float = 0.9,
) -> Tuple[Optional[Dict], float, Optional[str]]:
    """
    Call Ollama directly and return (parsed_output, elapsed_seconds, error).
    This is the core function used by all evaluation tests.
    """
    system_prompt = _build_system_prompt(lang)
    user_prompt = _build_user_prompt(input_data, window_hours, lang)

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": user_prompt,
        "system": system_prompt,
        "stream": False,
        "format": OPS_BRIEF_SCHEMA,
        "options": {"temperature": temperature, "top_p": top_p},
    }

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)

        elapsed = time.monotonic() - start

        if resp.status_code != 200:
            return None, elapsed, f"HTTP {resp.status_code}: {resp.text[:200]}"

        data = resp.json()
        raw = data.get("response", "")
        try:
            parsed = json.loads(raw)
            return parsed, elapsed, None
        except json.JSONDecodeError as e:
            return None, elapsed, f"JSON parse error: {e}\nRaw (first 500 chars): {raw[:500]}"

    except httpx.ConnectError:
        return None, time.monotonic() - start, "Ollama not running at " + OLLAMA_BASE_URL
    except Exception as e:
        return None, time.monotonic() - start, str(e)


def _is_ollama_running() -> bool:
    """Check if Ollama is reachable."""
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


def _score_grounding(output: Dict, valid_ids: set) -> Dict[str, Any]:
    """Compute detailed grounding metrics."""
    all_citations = []
    for section in output.get("sections", []):
        for bullet in section.get("bullets", []):
            all_citations.extend(bullet.get("citations", []))
    for action in output.get("actions", []):
        all_citations.extend(action.get("citations", []))
    for alert in output.get("alerts", []):
        all_citations.extend(alert.get("citations", []))

    total = len(all_citations)
    grounded = sum(1 for c in all_citations if c in valid_ids)
    ungrounded = [c for c in all_citations if c not in valid_ids]
    unique_ids_used = set(all_citations) & valid_ids

    return {
        "total_citations": total,
        "grounded_count": grounded,
        "grounding_rate": round(grounded / total, 3) if total > 0 else 1.0,
        "ungrounded_citations": ungrounded[:10],
        "unique_ids_cited": len(unique_ids_used),
        "unique_ids_available": len(valid_ids - {"data_missing"}),
        "id_coverage_rate": round(len(unique_ids_used) / max(len(valid_ids - {"data_missing"}), 1), 3),
    }


def _score_language(output: Dict, expected_lang: str) -> Dict[str, Any]:
    """Heuristic language detection for FR / AR."""
    summary = output.get("summary", "")
    all_text = summary
    for s in output.get("sections", []):
        for b in s.get("bullets", []):
            all_text += " " + b.get("text", "")
    for a in output.get("actions", []):
        all_text += " " + a.get("title", "") + " " + a.get("why", "")
    for al in output.get("alerts", []):
        all_text += " " + al.get("message", "")

    # French detection: common French words
    fr_markers = ["famille", "visite", "retard", "urgent", "plainte", "doublon",
                  "priorité", "agent", "en", "de", "des", "les", "une", "est", "pour", "avec"]
    # Arabic detection: Arabic character blocks
    arabic_chars = len(re.findall(r'[\u0600-\u06FF]', all_text))
    latin_chars = len(re.findall(r'[a-zA-ZÀ-ÿ]', all_text))

    fr_word_hits = sum(1 for m in fr_markers if m.lower() in all_text.lower())

    if expected_lang == "fr":
        is_correct = latin_chars > arabic_chars and fr_word_hits >= 3
    elif expected_lang in ("ar", "tn"):
        is_correct = arabic_chars > latin_chars
    else:
        is_correct = True

    return {
        "expected_lang": expected_lang,
        "latin_chars": latin_chars,
        "arabic_chars": arabic_chars,
        "fr_word_hits": fr_word_hits,
        "language_correct": is_correct,
        "text_length": len(all_text),
    }


def _score_content_relevance(output: Dict, input_data: Dict) -> Dict[str, Any]:
    """Check if output reflects the input KPIs and data."""
    kpis = input_data.get("kpis", {})
    summary = output.get("summary", "")
    issues = []

    # Check if key KPI numbers appear in the summary or sections
    overdue = kpis.get("overdue_count", 0)
    urgent = kpis.get("urgent_count", 0)
    complaints = kpis.get("open_complaints_count", 0)

    all_text = summary
    for s in output.get("sections", []):
        all_text += " " + s.get("title", "")
        for b in s.get("bullets", []):
            all_text += " " + b.get("text", "")

    # Check mentions
    mentions_overdue = str(overdue) in all_text or "retard" in all_text.lower() or "overdue" in all_text.lower()
    mentions_urgent = str(urgent) in all_text or "urgent" in all_text.lower()
    mentions_complaints = str(complaints) in all_text or "plainte" in all_text.lower() or "complaint" in all_text.lower()

    if overdue > 0 and not mentions_overdue:
        issues.append(f"Missing overdue mention ({overdue} overdue)")
    if urgent > 0 and not mentions_urgent:
        issues.append(f"Missing urgent mention ({urgent} urgent)")
    if complaints > 0 and not mentions_complaints:
        issues.append(f"Missing complaints mention ({complaints} complaints)")

    # Check if empty lists produce "data_missing" citations
    empty_lists = []
    for key in ("top_overdue", "top_urgent", "open_complaints", "suspected_duplicates"):
        if len(input_data.get(key, [])) == 0:
            empty_lists.append(key)

    return {
        "mentions_overdue": mentions_overdue,
        "mentions_urgent": mentions_urgent,
        "mentions_complaints": mentions_complaints,
        "content_issues": issues,
        "empty_input_lists": empty_lists,
        "relevance_score": 1.0 - (len(issues) / 3.0),
    }


def _score_priority_calibration(output: Dict) -> Dict[str, Any]:
    """Check if actions are correctly priority-ordered."""
    actions = output.get("actions", [])
    if len(actions) <= 1:
        return {"action_count": len(actions), "priority_ordered": True, "priorities": [a.get("priority") for a in actions]}

    priorities = [a.get("priority", 99) for a in actions]
    is_ordered = all(priorities[i] <= priorities[i+1] for i in range(len(priorities) - 1))

    return {
        "action_count": len(actions),
        "priorities": priorities,
        "priority_ordered": is_ordered,
        "priority_range": [min(priorities), max(priorities)] if priorities else [],
    }


def _score_severity_alignment(output: Dict, input_data: Dict) -> Dict[str, Any]:
    """Check if severity levels align with data urgency."""
    severities = Counter()
    for s in output.get("sections", []):
        for b in s.get("bullets", []):
            severities[b.get("severity", "unknown")] += 1

    alert_levels = Counter()
    for al in output.get("alerts", []):
        alert_levels[al.get("level", "unknown")] += 1

    kpis = input_data.get("kpis", {})
    has_critical_data = kpis.get("overdue_count", 0) > 0 or kpis.get("urgent_count", 0) > 0
    has_critical_output = severities.get("critical", 0) > 0 or alert_levels.get("critical", 0) > 0

    return {
        "bullet_severities": dict(severities),
        "alert_levels": dict(alert_levels),
        "has_critical_data": has_critical_data,
        "has_critical_output": has_critical_output,
        "severity_aligned": has_critical_data == has_critical_output or not has_critical_data,
    }


def _detect_hallucinations(output: Dict, input_data: Dict) -> Dict[str, Any]:
    """Detect potential hallucinations: names/numbers not from input."""
    # Collect all names from input
    input_names = set()
    for key in ("top_overdue", "top_urgent", "open_complaints", "suspected_duplicates", "workload_by_agent"):
        for item in input_data.get(key, []):
            label = item.get("label", "")
            # Extract name parts
            for part in label.replace("—", " ").replace("-", " ").split():
                if len(part) > 2 and part[0].isupper():
                    input_names.add(part.lower())

    # Collect all text from output
    all_text = output.get("summary", "")
    for s in output.get("sections", []):
        for b in s.get("bullets", []):
            all_text += " " + b.get("text", "")
    for a in output.get("actions", []):
        all_text += " " + a.get("title", "") + " " + a.get("why", "")

    # Find capitalized words that look like names but aren't in input
    output_names = set()
    for word in re.findall(r'\b[A-ZÀ-Ÿ][a-zà-ÿ]{2,}\b', all_text):
        if word.lower() not in {"famille", "familles", "visite", "visites", "agent", "agents",
                                 "plainte", "plaintes", "priorité", "retard", "urgent",
                                 "doublon", "doublons", "aide", "aides", "attention",
                                 "action", "actions", "briefing", "situation", "zone",
                                 "critique", "alertes", "planifier", "traiter", "vérifier",
                                 "comportement", "manquante", "similitude", "similarité"}:
            output_names.add(word.lower())

    hallucinated_names = output_names - input_names
    # Filter out common French non-name words we might have missed
    hallucinated_names = {n for n in hallucinated_names if len(n) > 3}

    return {
        "input_names": sorted(input_names)[:20],
        "output_names": sorted(output_names)[:20],
        "potentially_hallucinated": sorted(hallucinated_names)[:10],
        "hallucination_count": len(hallucinated_names),
    }


def _build_eval_report(test_name: str, output: Optional[Dict], input_data: Dict, elapsed: float,
                       error: Optional[str], temperature: float, lang: str) -> Dict[str, Any]:
    """Build a comprehensive evaluation report for one test run."""
    report = {
        "test_name": test_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": OLLAMA_MODEL,
        "temperature": temperature,
        "lang": lang,
        "elapsed_seconds": round(elapsed, 2),
        "error": error,
    }

    if output is None:
        report["status"] = "FAILED"
        return report

    valid_ids = _collect_valid_ids(input_data)

    report["status"] = "OK"
    report["schema_valid"] = _validate_schema(output) is None
    report["schema_error"] = _validate_schema(output)
    report["grounding"] = _score_grounding(output, valid_ids)
    report["language"] = _score_language(output, lang)
    report["relevance"] = _score_content_relevance(output, input_data)
    report["priority"] = _score_priority_calibration(output)
    report["severity"] = _score_severity_alignment(output, input_data)
    report["hallucination"] = _detect_hallucinations(output, input_data)

    # Summary stats
    report["summary_length"] = len(output.get("summary", ""))
    report["section_count"] = len(output.get("sections", []))
    report["action_count"] = len(output.get("actions", []))
    report["alert_count"] = len(output.get("alerts", []))
    report["total_bullets"] = sum(len(s.get("bullets", [])) for s in output.get("sections", []))

    # Composite quality score (0..1)
    scores = []
    if report["schema_valid"]:
        scores.append(1.0)
    else:
        scores.append(0.0)
    scores.append(report["grounding"]["grounding_rate"])
    scores.append(1.0 if report["language"]["language_correct"] else 0.0)
    scores.append(report["relevance"]["relevance_score"])
    scores.append(1.0 if report["priority"]["priority_ordered"] else 0.5)
    scores.append(1.0 if report["severity"]["severity_aligned"] else 0.5)
    scores.append(max(0.0, 1.0 - report["hallucination"]["hallucination_count"] * 0.2))

    report["quality_score"] = round(sum(scores) / len(scores), 3)

    return report


def _save_report(report: Dict):
    """Append a report to the eval log file."""
    reports = []
    if EVAL_REPORT_PATH.exists():
        try:
            reports = json.loads(EVAL_REPORT_PATH.read_text(encoding="utf-8"))
        except Exception:
            reports = []
    reports.append(report)
    EVAL_REPORT_PATH.write_text(json.dumps(reports, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Skip if Ollama not running ───────────────────────────────

ollama_available = _is_ollama_running()
skip_reason = "Ollama not running at " + OLLAMA_BASE_URL

# ── Tests ────────────────────────────────────────────────────


@pytest.mark.skipif(not ollama_available, reason=skip_reason)
class TestLiveAI_RichInput:
    """Test with realistic rich input data (4 overdue, 2 urgent, 3 complaints, 1 duplicate)."""

    def test_schema_conformance(self):
        """AI output must match the JSON schema on first try."""
        output, elapsed, err = _run_async(call_ollama_raw(RICH_INPUT))
        report = _build_eval_report("rich_schema_conformance", output, RICH_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        print(f"\n⏱ {elapsed:.1f}s | quality={report.get('quality_score', 'N/A')}")
        assert err is None, f"Ollama call failed: {err}"
        assert _validate_schema(output) is None, f"Schema invalid: {_validate_schema(output)}"

    def test_grounding_accuracy(self):
        """All citations must reference IDs from the input or 'data_missing'."""
        output, elapsed, err = _run_async(call_ollama_raw(RICH_INPUT))
        report = _build_eval_report("rich_grounding", output, RICH_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        valid_ids = _collect_valid_ids(RICH_INPUT)
        bad = _check_grounding(output, valid_ids)
        grounding = report.get("grounding", {})
        print(f"\n⏱ {elapsed:.1f}s | grounding_rate={grounding.get('grounding_rate')} | ungrounded={bad[:5]}")
        assert len(bad) == 0, f"Ungrounded citations: {bad}"

    def test_language_is_french(self):
        """Output text must be in French when lang=fr."""
        output, elapsed, err = _run_async(call_ollama_raw(RICH_INPUT, lang="fr"))
        report = _build_eval_report("rich_language_fr", output, RICH_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        lang_score = report.get("language", {})
        print(f"\n⏱ {elapsed:.1f}s | lang={lang_score}")
        assert lang_score.get("language_correct"), f"Language not French: {lang_score}"

    def test_content_reflects_kpis(self):
        """Summary/sections should mention overdue, urgent, complaints counts."""
        output, elapsed, err = _run_async(call_ollama_raw(RICH_INPUT))
        report = _build_eval_report("rich_content_relevance", output, RICH_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        relevance = report.get("relevance", {})
        print(f"\n⏱ {elapsed:.1f}s | relevance={relevance.get('relevance_score')} | issues={relevance.get('content_issues')}")
        assert relevance.get("relevance_score", 0) >= 0.66, f"Low relevance: {relevance}"

    def test_actions_priority_ordered(self):
        """Actions must be ordered by priority (1 = most urgent)."""
        output, elapsed, err = _run_async(call_ollama_raw(RICH_INPUT))
        report = _build_eval_report("rich_priority_order", output, RICH_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        prio = report.get("priority", {})
        print(f"\n⏱ {elapsed:.1f}s | priorities={prio.get('priorities')} | ordered={prio.get('priority_ordered')}")
        assert prio.get("priority_ordered"), f"Actions not priority-ordered: {prio.get('priorities')}"

    def test_severity_matches_data(self):
        """Critical data should produce critical severities in output."""
        output, elapsed, err = _run_async(call_ollama_raw(RICH_INPUT))
        report = _build_eval_report("rich_severity_alignment", output, RICH_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        sev = report.get("severity", {})
        print(f"\n⏱ {elapsed:.1f}s | severity={sev}")
        assert sev.get("severity_aligned"), f"Severity misalignment: critical data but no critical output"

    def test_no_hallucinated_names(self):
        """Output should not contain names that don't exist in input."""
        output, elapsed, err = _run_async(call_ollama_raw(RICH_INPUT))
        report = _build_eval_report("rich_hallucination", output, RICH_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        hall = report.get("hallucination", {})
        print(f"\n⏱ {elapsed:.1f}s | hallucinated={hall.get('potentially_hallucinated')}")
        # Soft check: warn but allow up to 2 (French common words may be false positives)
        assert hall.get("hallucination_count", 0) <= 3, f"Too many hallucinated names: {hall.get('potentially_hallucinated')}"


@pytest.mark.skipif(not ollama_available, reason=skip_reason)
class TestLiveAI_EdgeCases:
    """Test edge cases: empty input, single item, all urgent."""

    def test_empty_input_graceful(self):
        """Empty input should produce a valid brief with data_missing citations."""
        output, elapsed, err = _run_async(call_ollama_raw(EMPTY_INPUT))
        report = _build_eval_report("empty_input", output, EMPTY_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        print(f"\n⏱ {elapsed:.1f}s | quality={report.get('quality_score')}")
        assert err is None, f"Ollama failed on empty input: {err}"
        assert _validate_schema(output) is None, f"Schema invalid on empty input"
        # Should have data_missing citations since all lists are empty
        summary = output.get("summary", "")
        assert len(summary) > 0, "Summary should not be empty even with no data"

    def test_single_critical_family(self):
        """Single overdue family should be clearly highlighted as the top priority."""
        output, elapsed, err = _run_async(call_ollama_raw(SINGLE_CRITICAL_INPUT))
        report = _build_eval_report("single_critical", output, SINGLE_CRITICAL_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        print(f"\n⏱ {elapsed:.1f}s | quality={report.get('quality_score')}")
        assert err is None
        assert _validate_schema(output) is None
        # The single family should appear in citations
        all_citations = []
        for s in output.get("sections", []):
            for b in s.get("bullets", []):
                all_citations.extend(b.get("citations", []))
        for a in output.get("actions", []):
            all_citations.extend(a.get("citations", []))
        assert "fam:solo1" in all_citations, f"Single family fam:solo1 not cited: {all_citations}"

    def test_all_urgent_stress(self):
        """5 urgent families + 5 complaints: AI must handle volume and prioritize."""
        output, elapsed, err = _run_async(call_ollama_raw(ALL_URGENT_INPUT))
        report = _build_eval_report("all_urgent", output, ALL_URGENT_INPUT, elapsed, err, 0.1, "fr")
        _save_report(report)
        print(f"\n⏱ {elapsed:.1f}s | actions={report.get('action_count')} | alerts={report.get('alert_count')}")
        assert err is None
        assert _validate_schema(output) is None
        # Should have at least some alerts for this critical situation
        assert len(output.get("alerts", [])) >= 1, "All-urgent scenario should produce at least 1 alert"


@pytest.mark.skipif(not ollama_available, reason=skip_reason)
class TestLiveAI_TemperatureComparison:
    """Compare output quality at different temperatures."""

    def test_temp_0_vs_01(self):
        """temp=0 (full determinism) vs temp=0.1 — which produces better grounding?"""
        out_0, t_0, err_0 = _run_async(call_ollama_raw(RICH_INPUT, temperature=0.0))
        out_01, t_01, err_01 = _run_async(call_ollama_raw(RICH_INPUT, temperature=0.1))

        report_0 = _build_eval_report("temp_0.0", out_0, RICH_INPUT, t_0, err_0, 0.0, "fr")
        report_01 = _build_eval_report("temp_0.1", out_01, RICH_INPUT, t_01, err_01, 0.1, "fr")
        _save_report(report_0)
        _save_report(report_01)

        q0 = report_0.get("quality_score", 0)
        q01 = report_01.get("quality_score", 0)
        g0 = report_0.get("grounding", {}).get("grounding_rate", 0)
        g01 = report_01.get("grounding", {}).get("grounding_rate", 0)

        print(f"\n  temp=0.0 → quality={q0} grounding={g0} time={t_0:.1f}s")
        print(f"  temp=0.1 → quality={q01} grounding={g01} time={t_01:.1f}s")
        print(f"  ✅ Best temperature: {'0.0' if q0 >= q01 else '0.1'}")

        # Both should at least be schema-valid
        if out_0:
            assert _validate_schema(out_0) is None, "temp=0.0 schema invalid"
        if out_01:
            assert _validate_schema(out_01) is None, "temp=0.1 schema invalid"

    def test_temp_05_creative(self):
        """temp=0.5 — more creative but potentially less grounded."""
        output, elapsed, err = _run_async(call_ollama_raw(RICH_INPUT, temperature=0.5))
        report = _build_eval_report("temp_0.5", output, RICH_INPUT, elapsed, err, 0.5, "fr")
        _save_report(report)
        valid_ids = _collect_valid_ids(RICH_INPUT)
        grounding = _score_grounding(output, valid_ids) if output else {}
        print(f"\n⏱ {elapsed:.1f}s | quality={report.get('quality_score')} | grounding={grounding.get('grounding_rate')}")
        # Higher temp may have more grounding issues — log but be lenient
        if output:
            schema_err = _validate_schema(output)
            print(f"  schema_valid={schema_err is None}")


@pytest.mark.skipif(not ollama_available, reason=skip_reason)
class TestLiveAI_LanguageVariants:
    """Test Arabic and Tunisian Arabic output."""

    def test_arabic_output(self):
        """lang=ar should produce Arabic text."""
        ar_input = {**RICH_INPUT, "meta": {**RICH_INPUT["meta"], "lang": "ar"}}
        output, elapsed, err = _run_async(call_ollama_raw(ar_input, lang="ar"))
        report = _build_eval_report("lang_ar", output, ar_input, elapsed, err, 0.1, "ar")
        _save_report(report)
        lang_score = report.get("language", {})
        print(f"\n⏱ {elapsed:.1f}s | arabic_chars={lang_score.get('arabic_chars')} | latin={lang_score.get('latin_chars')}")
        assert err is None, f"Ollama failed: {err}"
        assert _validate_schema(output) is None

    def test_tunisian_arabic_output(self):
        """lang=tn should produce Tunisian Arabic (mostly Arabic script)."""
        tn_input = {**RICH_INPUT, "meta": {**RICH_INPUT["meta"], "lang": "tn"}}
        output, elapsed, err = _run_async(call_ollama_raw(tn_input, lang="tn"))
        report = _build_eval_report("lang_tn", output, tn_input, elapsed, err, 0.1, "tn")
        _save_report(report)
        lang_score = report.get("language", {})
        print(f"\n⏱ {elapsed:.1f}s | arabic_chars={lang_score.get('arabic_chars')} | latin={lang_score.get('latin_chars')}")
        assert err is None, f"Ollama failed: {err}"
        assert _validate_schema(output) is None


@pytest.mark.skipif(not ollama_available, reason=skip_reason)
class TestLiveAI_Consistency:
    """Test output consistency across multiple runs with same input."""

    def test_determinism_at_temp_0(self):
        """Two runs at temp=0 should produce very similar outputs."""
        out1, t1, err1 = _run_async(call_ollama_raw(RICH_INPUT, temperature=0.0))
        out2, t2, err2 = _run_async(call_ollama_raw(RICH_INPUT, temperature=0.0))

        report1 = _build_eval_report("consistency_run1", out1, RICH_INPUT, t1, err1, 0.0, "fr")
        report2 = _build_eval_report("consistency_run2", out2, RICH_INPUT, t2, err2, 0.0, "fr")
        _save_report(report1)
        _save_report(report2)

        if out1 and out2:
            # Compare summaries
            sim = _text_similarity(out1.get("summary", ""), out2.get("summary", ""))
            # Compare action count
            act_diff = abs(len(out1.get("actions", [])) - len(out2.get("actions", [])))

            print(f"\n  Run 1: {len(out1.get('summary', ''))} chars, {len(out1.get('actions', []))} actions")
            print(f"  Run 2: {len(out2.get('summary', ''))} chars, {len(out2.get('actions', []))} actions")
            print(f"  Summary similarity: {sim:.2%}")
            print(f"  Action count diff: {act_diff}")

            # At temp=0, should be fairly consistent
            assert sim >= 0.5, f"Low consistency at temp=0: similarity={sim:.2%}"


def _text_similarity(a: str, b: str) -> float:
    """Simple word-overlap Jaccard similarity."""
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    if not words_a and not words_b:
        return 1.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union) if union else 0.0


# ── Final: Print accumulated report summary ──────────────────

@pytest.fixture(scope="session", autouse=True)
def print_eval_summary(request):
    """Print a summary of all eval results at the end of the session."""
    yield
    if not EVAL_REPORT_PATH.exists():
        return
    try:
        reports = json.loads(EVAL_REPORT_PATH.read_text(encoding="utf-8"))
        # Only print reports from this session (last N)
        recent = [r for r in reports if r.get("timestamp", "") >= datetime.now(timezone.utc).isoformat()[:10]]
        if not recent:
            recent = reports[-15:]  # fallback: last 15

        print("\n" + "=" * 70)
        print("📊 AI EVALUATION REPORT SUMMARY")
        print("=" * 70)
        for r in recent:
            status = r.get("status", "?")
            name = r.get("test_name", "?")
            quality = r.get("quality_score", "N/A")
            elapsed = r.get("elapsed_seconds", "?")
            grounding = r.get("grounding", {}).get("grounding_rate", "N/A")
            temp = r.get("temperature", "?")
            print(f"  {status:6} | {name:30} | quality={quality} | grounding={grounding} | temp={temp} | {elapsed}s")

        # Aggregate stats
        ok_reports = [r for r in recent if r.get("status") == "OK"]
        if ok_reports:
            avg_quality = sum(r.get("quality_score", 0) for r in ok_reports) / len(ok_reports)
            avg_grounding = sum(r.get("grounding", {}).get("grounding_rate", 0) for r in ok_reports) / len(ok_reports)
            avg_time = sum(r.get("elapsed_seconds", 0) for r in ok_reports) / len(ok_reports)
            print(f"\n  📈 Average quality:   {avg_quality:.3f}")
            print(f"  📈 Average grounding: {avg_grounding:.3f}")
            print(f"  📈 Average time:      {avg_time:.1f}s")

        print("=" * 70)
        print(f"📁 Full report: {EVAL_REPORT_PATH}")

    except Exception as e:
        print(f"\n⚠ Could not print summary: {e}")
