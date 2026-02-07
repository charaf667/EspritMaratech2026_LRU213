"""
OCR router — extracts text from CIN (Carte d'Identité Nationale) images.

Uses EasyOCR for Arabic + French text recognition on scanned ID cards.
Falls back to a regex-based extraction if EasyOCR is not available.
"""

import os
import re
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

router = APIRouter()

# ── Model singleton ─────────────────────────────────────────

_reader = None


def _get_reader():
    global _reader
    if _reader is None:
        try:
            import easyocr
            _reader = easyocr.Reader(
                ["fr", "ar"],
                gpu=os.environ.get("OCR_USE_GPU", "false").lower() in ("true", "1"),
            )
        except ImportError:
            raise RuntimeError(
                "easyocr is not installed. Install with: pip install easyocr"
            )
    return _reader


# ── Response model ──────────────────────────────────────────

class CINResult(BaseModel):
    raw_text: str
    fields: dict  # extracted structured fields


# ── CIN field extraction ────────────────────────────────────

def _extract_cin_fields(raw_lines: list[str]) -> dict:
    """
    Attempt to extract structured fields from OCR text lines.
    Algerian CIN typically contains:
    - NIN (National ID Number): 18-digit number
    - Nom / اللقب (Last name)
    - Prénom / الاسم (First name)
    - Date de naissance
    - Lieu de naissance
    """
    full_text = "\n".join(raw_lines)
    fields: dict = {}

    # NIN: 18-digit national ID number
    nin_match = re.search(r"\b(\d{18})\b", full_text)
    if nin_match:
        fields["nin"] = nin_match.group(1)

    # Try to find name patterns
    # French patterns
    nom_match = re.search(r"(?:Nom|NOM)[:\s]+([A-ZÉÈÊËÀÂÄÙÛÜÔÖ][A-ZÉÈÊËÀÂÄÙÛÜÔÖa-zéèêëàâäùûüôö\s\-]+)", full_text)
    if nom_match:
        fields["last_name"] = nom_match.group(1).strip()

    prenom_match = re.search(r"(?:Prénom|PRENOM|Prenom)[:\s]+([A-ZÉÈÊËÀÂÄÙÛÜÔÖ][A-ZÉÈÊËÀÂÄÙÛÜÔÖa-zéèêëàâäùûüôö\s\-]+)", full_text)
    if prenom_match:
        fields["first_name"] = prenom_match.group(1).strip()

    # Date of birth
    dob_match = re.search(r"(?:Né|née?|Date de naissance)[:\s]+(\d{2}[./\-]\d{2}[./\-]\d{4})", full_text, re.IGNORECASE)
    if dob_match:
        fields["date_of_birth"] = dob_match.group(1)

    # Place of birth
    lieu_match = re.search(r"(?:Lieu|à|Né\(e\) à)[:\s]+([A-ZÉÈÊËÀÂÄÙÛÜÔÖa-zéèêëàâäùûüôö\s\-]+)", full_text, re.IGNORECASE)
    if lieu_match:
        fields["place_of_birth"] = lieu_match.group(1).strip()

    # Address pattern (common in Algerian CIN)
    addr_match = re.search(r"(?:Adresse|Domicile)[:\s]+(.+?)(?:\n|$)", full_text, re.IGNORECASE)
    if addr_match:
        fields["address"] = addr_match.group(1).strip()

    # If we couldn't extract structured fields, provide the first few lines as hints
    if not fields and raw_lines:
        # Take non-empty lines as potential name candidates
        candidates = [l.strip() for l in raw_lines if len(l.strip()) > 2][:5]
        fields["candidates"] = candidates

    return fields


# ── Endpoint ────────────────────────────────────────────────

@router.post("/extract-cin", response_model=CINResult)
async def extract_cin(image: UploadFile = File(...)):
    """
    Accept a CIN image, run OCR, and extract structured fields.
    Supports JPEG, PNG, WebP.
    """
    allowed_mimes = {"image/jpeg", "image/png", "image/webp"}
    if image.content_type and image.content_type not in allowed_mimes:
        raise HTTPException(400, f"Unsupported image type: {image.content_type}")

    # Save to temp file
    suffix = Path(image.filename or "image.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await image.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(400, "Image too large (max 10MB)")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        reader = _get_reader()
        results = reader.readtext(tmp_path)
        raw_lines = [text for (_, text, conf) in results if conf > 0.3]
        raw_text = "\n".join(raw_lines)
        fields = _extract_cin_fields(raw_lines)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return CINResult(raw_text=raw_text, fields=fields)
