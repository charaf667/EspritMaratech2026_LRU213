"""
Tests for ops brief schema validation and grounding checks.
Run with: python -m pytest tests/test_ops_brief.py -v
"""

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

# Add parent to path so we can import routers
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routers.ops_brief import (
    OPS_BRIEF_SCHEMA,
    _validate_schema,
    _check_grounding,
    _collect_valid_ids,
    _build_system_prompt,
    _build_user_prompt,
)


# ── Sample fixtures ──────────────────────────────────────────

VALID_OUTPUT = {
    "meta": {
        "generated_at": "2026-02-08T03:00:00Z",
        "window_hours": 24,
        "lang": "fr",
        "model": "qwen2.5-14b-instruct",
    },
    "summary": "3 familles en retard, 1 urgence active.",
    "sections": [
        {
            "title": "Familles en retard",
            "bullets": [
                {
                    "text": "Famille X en retard de 10 jours",
                    "severity": "critical",
                    "citations": ["fam:123"],
                }
            ],
        }
    ],
    "actions": [
        {
            "title": "Visiter Famille X",
            "why": "Retard critique",
            "priority": 1,
            "target_url": "/app/admin?section=families&id=123",
            "citations": ["fam:123"],
        }
    ],
    "alerts": [
        {
            "level": "critical",
            "message": "3 familles en retard",
            "citations": ["fam:123"],
        }
    ],
}

SAMPLE_INPUT = {
    "meta": {"schema_version": "1", "generated_at": "2026-02-08T03:00:00Z", "window_hours": 24, "lang": "fr", "data_missing": []},
    "kpis": {"overdue_count": 3, "urgent_count": 1, "open_complaints_count": 0, "suspected_duplicates_count": 0, "visits_last_24h": 5, "families_total": 20},
    "top_overdue": [{"id": "fam:123", "label": "Famille X", "priority": "overdue", "target_url": "/x", "evidence": "10d", "timestamp": "2026-02-08T03:00:00Z"}],
    "top_urgent": [{"id": "fam:456", "label": "Famille Y", "priority": "urgent", "target_url": "/y", "evidence": "urgent", "timestamp": "2026-02-08T03:00:00Z"}],
    "open_complaints": [],
    "suspected_duplicates": [{"id": "dup:1-2", "label": "1 vs 2", "priority": "high", "target_url": "/d", "evidence": "sim", "timestamp": "2026-02-08T03:00:00Z"}],
    "workload_by_agent": [{"id": "usr:1", "label": "Agent A", "priority": "medium", "target_url": "/a", "evidence": "5 assigned", "timestamp": "2026-02-08T03:00:00Z"}],
}


# ── Tests: Schema validation ─────────────────────────────────

class TestSchemaValidation:
    def test_valid_output_passes(self):
        err = _validate_schema(VALID_OUTPUT)
        assert err is None

    def test_missing_summary_fails(self):
        bad = {**VALID_OUTPUT}
        del bad["summary"]
        err = _validate_schema(bad)
        assert err is not None
        assert "summary" in err

    def test_missing_meta_model_fails(self):
        bad = {**VALID_OUTPUT, "meta": {"generated_at": "2026-01-01T00:00:00Z", "window_hours": 24, "lang": "fr"}}
        err = _validate_schema(bad)
        assert err is not None
        assert "model" in err

    def test_invalid_severity_fails(self):
        bad = json.loads(json.dumps(VALID_OUTPUT))
        bad["sections"][0]["bullets"][0]["severity"] = "extreme"
        err = _validate_schema(bad)
        assert err is not None

    def test_action_priority_out_of_range_fails(self):
        bad = json.loads(json.dumps(VALID_OUTPUT))
        bad["actions"][0]["priority"] = 10
        err = _validate_schema(bad)
        assert err is not None

    def test_empty_sections_actions_alerts_passes(self):
        minimal = {
            "meta": {"generated_at": "2026-01-01T00:00:00Z", "window_hours": 24, "lang": "fr", "model": "test"},
            "summary": "Nothing to report.",
            "sections": [],
            "actions": [],
            "alerts": [],
        }
        err = _validate_schema(minimal)
        assert err is None

    def test_additional_properties_rejected(self):
        bad = {**VALID_OUTPUT, "extra_field": "not allowed"}
        err = _validate_schema(bad)
        assert err is not None


# ── Tests: Grounding check ───────────────────────────────────

class TestGroundingCheck:
    def test_valid_citations_pass(self):
        valid_ids = _collect_valid_ids(SAMPLE_INPUT)
        bad = _check_grounding(VALID_OUTPUT, valid_ids)
        assert bad == []

    def test_unknown_citation_rejected(self):
        valid_ids = _collect_valid_ids(SAMPLE_INPUT)
        bad_output = json.loads(json.dumps(VALID_OUTPUT))
        bad_output["actions"][0]["citations"] = ["fam:UNKNOWN"]
        bad = _check_grounding(bad_output, valid_ids)
        assert "fam:UNKNOWN" in bad

    def test_data_missing_always_valid(self):
        valid_ids = _collect_valid_ids(SAMPLE_INPUT)
        output = json.loads(json.dumps(VALID_OUTPUT))
        output["sections"][0]["bullets"][0]["citations"] = ["data_missing"]
        bad = _check_grounding(output, valid_ids)
        assert bad == []

    def test_collect_valid_ids_includes_all_lists(self):
        ids = _collect_valid_ids(SAMPLE_INPUT)
        assert "fam:123" in ids
        assert "fam:456" in ids
        assert "dup:1-2" in ids
        assert "usr:1" in ids
        assert "data_missing" in ids

    def test_empty_input_still_has_data_missing(self):
        empty_input = {
            "meta": {}, "kpis": {},
            "top_overdue": [], "top_urgent": [],
            "open_complaints": [], "suspected_duplicates": [],
            "workload_by_agent": [],
        }
        ids = _collect_valid_ids(empty_input)
        assert ids == {"data_missing"}


# ── Tests: Prompt building ───────────────────────────────────

class TestPromptBuilding:
    def test_system_prompt_contains_language(self):
        prompt = _build_system_prompt("fr")
        assert "French" in prompt

    def test_system_prompt_ar(self):
        prompt = _build_system_prompt("ar")
        assert "Arabic" in prompt

    def test_user_prompt_contains_schema(self):
        prompt = _build_user_prompt(SAMPLE_INPUT, 24, "fr")
        assert "JSON_SCHEMA" in prompt
        assert "INPUT_JSON" in prompt
        assert "fam:123" in prompt
