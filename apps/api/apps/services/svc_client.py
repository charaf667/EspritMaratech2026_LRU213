"""
Client module for server-to-server calls from Django to FastAPI services.

All internal service calls go through this module so there is a single
place to manage the base URL, auth token, timeouts, and error handling.
"""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 30.0  # seconds (routing, OCR)
_STT_TIMEOUT = 120.0  # Whisper model loading + transcription


def _get_headers():
    return {"X-Internal-Token": settings.SVC_INTERNAL_TOKEN}


def forward_stt_transcribe(audio_file, lang=None):
    """
    Forward an audio file to the FastAPI STT service.

    Args:
        audio_file: Django UploadedFile (from request.FILES)
        lang: Optional language hint (fr, ar, tn). 'tn' is mapped to 'ar' by svc.

    Returns:
        (result_dict, None) on success
        (None, error_string) on failure
    """
    url = f"{settings.SVC_BASE_URL}/stt/transcribe-segment"
    params = {}
    if lang:
        params["lang"] = lang
    try:
        with httpx.Client(timeout=_STT_TIMEOUT) as client:
            response = client.post(
                url,
                headers=_get_headers(),
                params=params,
                files={"audio": (audio_file.name, audio_file, audio_file.content_type)},
            )
        if response.status_code == 200:
            return response.json(), None
        logger.error(
            "STT service returned %s: %s", response.status_code, response.text
        )
        return None, f"STT service error (HTTP {response.status_code})"
    except httpx.RequestError as exc:
        logger.exception("Failed to reach STT service: %s", exc)
        return None, "STT service unreachable"


def forward_ocr_extract(image_file):
    """
    Forward a CIN image to the FastAPI OCR service.

    Args:
        image_file: Django UploadedFile (from request.FILES)

    Returns:
        (result_dict, None) on success
        (None, error_string) on failure
    """
    url = f"{settings.SVC_BASE_URL}/ocr/extract-cin"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(
                url,
                headers=_get_headers(),
                files={"image": (image_file.name, image_file, image_file.content_type)},
            )
        if response.status_code == 200:
            return response.json(), None
        logger.error(
            "OCR service returned %s: %s", response.status_code, response.text
        )
        return None, f"OCR service error (HTTP {response.status_code})"
    except httpx.RequestError as exc:
        logger.exception("Failed to reach OCR service: %s", exc)
        return None, "OCR service unreachable"


def forward_ops_brief_generate(lang, window_hours, input_data):
    """
    Forward an ops brief generation request to the FastAPI LLM service.

    Args:
        lang: Language code (fr, ar, tn)
        window_hours: Time window for the brief
        input_data: The ops_brief_input payload dict

    Returns:
        (result_dict, None) on success
        (None, error_string) on failure
    """
    url = f"{settings.SVC_BASE_URL}/v1/ops/brief/generate"
    _ops_read_timeout = float(getattr(settings, "OPS_BRIEF_TIMEOUT_SECONDS", 120))
    _timeout = httpx.Timeout(connect=3.0, read=_ops_read_timeout, write=10.0, pool=10.0)
    try:
        with httpx.Client(timeout=_timeout) as client:
            response = client.post(
                url,
                headers=_get_headers(),
                json={
                    "lang": lang,
                    "window_hours": window_hours,
                    "input": input_data,
                },
            )
        if response.status_code == 200:
            return response.json(), None
        logger.error(
            "Ops brief service returned %s: %s", response.status_code, response.text
        )
        return None, f"Ops brief service error (HTTP {response.status_code})"
    except httpx.RequestError as exc:
        logger.exception("Failed to reach ops brief service: %s", exc)
        return None, "Ops brief service unreachable"


def forward_route_compute(points):
    """
    Forward a route computation request to the FastAPI routing service.

    Args:
        points: list of dicts with lat, lng, and optional label

    Returns:
        (result_dict, None) on success
        (None, error_string) on failure
    """
    url = f"{settings.SVC_BASE_URL}/routing/compute"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(
                url,
                headers=_get_headers(),
                json={"points": points},
            )
        if response.status_code == 200:
            return response.json(), None
        logger.error(
            "Routing service returned %s: %s", response.status_code, response.text
        )
        return None, f"Routing service error (HTTP {response.status_code})"
    except httpx.RequestError as exc:
        logger.exception("Failed to reach routing service: %s", exc)
        return None, "Routing service unreachable"
