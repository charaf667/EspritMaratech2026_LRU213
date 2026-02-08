"""
Ops Brief generation — Ollama LLM with structured JSON output.

Optimized for qwen2.5:3b (1.9 GB, 32K ctx):
  - Chat API (/api/chat) for better instruction following
  - Reduced context (num_ctx=4096) to save VRAM and speed up
  - Low temperature (0.05) for deterministic structured output
  - num_predict=2048 cap to prevent runaway generation
  - Concise system prompt — small models need short, directive instructions
  - Single retry on validation failure

Only called server-to-server from Django, never from the browser.
"""

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ──────────────────────────────────────────────────
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")
OPS_BRIEF_TIMEOUT = int(os.environ.get("OPS_BRIEF_TIMEOUT_SECONDS", "300"))

# Tuned for qwen2.5:3b — small model, needs tight constraints
OLLAMA_OPTIONS = {
    "temperature": 0.05,       # Near-deterministic for JSON
    "top_p": 0.85,             # Slightly constrained sampling
    "top_k": 20,               # Limit vocabulary choices
    "num_ctx": 6144,           # Enough for detailed prompt + rich output
    "num_predict": 3072,       # Allow 2-3x more detailed briefing
    "repeat_penalty": 1.1,     # Avoid repetitive text
}

# ── Load JSON Schema ────────────────────────────────────────
_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schemas" / "ops_brief.schema.json"
with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
    OPS_BRIEF_SCHEMA = json.load(f)

# ── Log directory ───────────────────────────────────────────
_LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)


# ── Pydantic models ─────────────────────────────────────────
class OpsBriefRequest(BaseModel):
    lang: str = "fr"
    window_hours: int = 24
    input: Dict[str, Any]


class OpsBriefResponse(BaseModel):
    success: bool
    output: Optional[Dict[str, Any]] = None
    fallback: bool = False
    error: Optional[str] = None
    timing_ms: Optional[int] = None


# ── Helpers ──────────────────────────────────────────────────

def _collect_valid_ids(input_data: Dict[str, Any]) -> set:
    """Collect all item IDs from the input payload for grounding checks."""
    ids = set()
    for key in ("top_overdue", "top_urgent", "open_complaints", "suspected_duplicates", "workload_by_agent"):
        for item in input_data.get(key, []):
            if "id" in item:
                ids.add(item["id"])
    ids.add("data_missing")
    return ids


def _validate_output(output: Dict[str, Any]) -> Optional[str]:
    """Light validation — check structure without being overly strict for 3B model."""
    try:
        if not isinstance(output, dict):
            return "output is not an object"

        required = {"meta", "summary", "sections", "actions", "alerts"}
        missing = required - output.keys()
        if missing:
            return f"missing keys: {missing}"

        if not isinstance(output.get("summary"), str) or not output["summary"]:
            return "summary must be a non-empty string"

        if not isinstance(output.get("sections"), list):
            return "sections must be an array"

        if not isinstance(output.get("actions"), list):
            return "actions must be an array"

        if not isinstance(output.get("alerts"), list):
            return "alerts must be an array"

        meta = output.get("meta", {})
        if not isinstance(meta, dict):
            return "meta must be an object"

        return None
    except Exception as e:
        return str(e)


def _check_grounding(output: Dict[str, Any], valid_ids: set) -> List[str]:
    """Check that citations reference known IDs. Returns list of bad citations."""
    bad = []
    for section in output.get("sections", []):
        for bullet in section.get("bullets", []):
            for c in bullet.get("citations", []):
                if c not in valid_ids:
                    bad.append(c)
    for action in output.get("actions", []):
        for c in action.get("citations", []):
            if c not in valid_ids:
                bad.append(c)
    for alert in output.get("alerts", []):
        for c in alert.get("citations", []):
            if c not in valid_ids:
                bad.append(c)
    return bad


def _patch_meta(output: Dict[str, Any], lang: str) -> Dict[str, Any]:
    """Ensure meta fields are correct — small models sometimes hallucinate these."""
    if "meta" not in output:
        output["meta"] = {}
    output["meta"]["generated_at"] = datetime.now(timezone.utc).isoformat()
    output["meta"]["lang"] = lang
    output["meta"]["model"] = OLLAMA_MODEL
    output["meta"]["window_hours"] = output["meta"].get("window_hours", 24)
    return output


# ── Prompt builders (concise for 3B) ─────────────────────────

_LANG_NAMES = {"fr": "français", "ar": "arabe", "tn": "arabe tunisien"}

def _build_system_prompt(lang: str) -> str:
    return f"""Tu es un analyste opérationnel pour OMNIA, plateforme humanitaire de terrain.
Règles:
- JSON valide uniquement, langue: {_LANG_NAMES.get(lang, 'français')}.
- Utilise SEULEMENT les données INPUT. Ne fabrique rien.
- Chaque citation = un id du INPUT.
- Chaque bullet: contexte + impact + recommandation.
- Résumé: 3-5 phrases avec chiffres clés."""


def _build_user_prompt(input_data: Dict[str, Any], window_hours: int) -> str:
    # Compact the input — remove empty lists to save tokens
    compact = {k: v for k, v in input_data.items() if v or k == "kpis"}

    return f"""DONNÉES OPÉRATIONNELLES (dernières {window_hours}h):
{json.dumps(compact, ensure_ascii=False, separators=(',',':'))}

Génère un briefing opérationnel DÉTAILLÉ en JSON. Structure:

{{"meta":{{"generated_at":"...","window_hours":{window_hours},"lang":"...","model":"..."}},
"summary":"Résumé exécutif de 4-6 phrases. Inclure: nombre de familles suivies, visites effectuées, retards critiques, plaintes en cours, charge de travail des agents. Mentionner les tendances et risques.",
"sections":[
  {{"title":"Indicateurs Clés (KPIs)","bullets":[{{"text":"Analyse détaillée d'un KPI avec contexte et impact","severity":"info|warning|critical","citations":["id"]}}]}},
  {{"title":"Retards & Suivis en Souffrance","bullets":[{{"text":"Pour chaque famille en retard: durée, impact sur le bénéficiaire, action recommandée","severity":"critical","citations":["id"]}}]}},
  {{"title":"Plaintes & Réclamations","bullets":[{{"text":"Détail de chaque plainte: sujet, famille concernée, durée d'ouverture, risque si non traitée","severity":"warning","citations":["id"]}}]}},
  {{"title":"Charge de Travail des Agents","bullets":[{{"text":"Répartition par agent: familles actives, visites du jour, surcharge ou sous-utilisation","severity":"info","citations":["id"]}}]}},
  {{"title":"Cas Urgents & Prioritaires","bullets":[{{"text":"Cas nécessitant une intervention immédiate avec justification","severity":"critical","citations":["id"]}}]}},
  {{"title":"Qualité des Données & Doublons","bullets":[{{"text":"Doublons suspectés, données manquantes, recommandations de nettoyage","severity":"info","citations":["data_missing"]}}}}
],
"actions":[
  {{"title":"Action concrète et spécifique","why":"Justification détaillée avec impact si non fait","priority":1,"target_url":"/app/admin?section=families","citations":["id"]}},
  {{"title":"Deuxième action","why":"...","priority":2,"target_url":"/app/admin?section=complaints","citations":["id"]}}
],
"alerts":[
  {{"level":"critical","message":"Alerte détaillée avec contexte, seuil dépassé et conséquence","citations":["id"]}},
  {{"level":"warning","message":"Avertissement avec recommandation préventive","citations":["id"]}}
]}}"""


def _log_request(input_hash: str, output: Any, timing_ms: int, error: Optional[str] = None):
    """Append a log entry to the ops brief log file."""
    try:
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "hash": input_hash,
            "ms": timing_ms,
            "err": error,
            "preview": str(output)[:300] if output else None,
        }
        log_file = _LOG_DIR / "ops_brief.log"
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        logger.warning("Failed to write ops brief log", exc_info=True)


async def _call_ollama(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    """Call Ollama Chat API with structured JSON output."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "format": OPS_BRIEF_SCHEMA,
        "options": OLLAMA_OPTIONS,
    }

    async with httpx.AsyncClient(timeout=OPS_BRIEF_TIMEOUT) as client:
        resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)

    if resp.status_code != 200:
        raise RuntimeError(f"Ollama HTTP {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    raw = data.get("message", {}).get("content", "")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON from Ollama: {e}\nRaw: {raw[:300]}")


# ── Endpoint ─────────────────────────────────────────────────

@router.post("/brief/generate", response_model=OpsBriefResponse)
async def generate_ops_brief(body: OpsBriefRequest):
    """
    Generate an AI operational briefing from input data.
    Uses Ollama chat API with qwen2.5:3b, validates structure + grounding.
    """
    start = time.monotonic()
    input_hash = hashlib.sha256(
        json.dumps(body.input, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()[:12]
    valid_ids = _collect_valid_ids(body.input)

    system_prompt = _build_system_prompt(body.lang)
    user_prompt = _build_user_prompt(body.input, body.window_hours)

    max_attempts = 2
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            output = await _call_ollama(system_prompt, user_prompt)

            # Always patch meta — small models hallucinate timestamps/model names
            output = _patch_meta(output, body.lang)

            # Validate structure
            err = _validate_output(output)
            if err:
                last_error = f"Validation: {err}"
                if attempt < max_attempts:
                    user_prompt += f"\n\nERREUR: {err}. Corrige et renvoie le JSON."
                    continue
                # On last attempt, still return partial output with fallback flag
                elapsed_ms = int((time.monotonic() - start) * 1000)
                _log_request(input_hash, output, elapsed_ms, error=last_error)
                return OpsBriefResponse(success=True, output=output, fallback=True, timing_ms=elapsed_ms)

            # Grounding check (lenient — just log, don't fail for 3B model)
            bad = _check_grounding(output, valid_ids)
            if bad:
                logger.info("Ungrounded citations (attempt %d): %s", attempt, bad[:5])

            elapsed_ms = int((time.monotonic() - start) * 1000)
            _log_request(input_hash, output, elapsed_ms)
            return OpsBriefResponse(
                success=True,
                output=output,
                fallback=bool(bad),
                timing_ms=elapsed_ms,
            )

        except Exception as e:
            last_error = str(e)
            logger.warning("Ops brief attempt %d failed: %s", attempt, e)
            if attempt < max_attempts:
                continue
            break

    elapsed_ms = int((time.monotonic() - start) * 1000)
    _log_request(input_hash, None, elapsed_ms, error=last_error)

    raise HTTPException(
        status_code=502,
        detail=f"LLM failed after {max_attempts} attempts: {last_error}",
    )
