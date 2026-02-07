"""
Internal authentication middleware.
All requests (except /health) must include X-Internal-Token header
matching the SVC_INTERNAL_TOKEN env var.
"""

import os

from fastapi import Request
from fastapi.responses import JSONResponse

_INTERNAL_TOKEN = os.environ.get("SVC_INTERNAL_TOKEN", "change-me-internal-secret")
_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json"}


async def verify_internal_token(request: Request, call_next):
    if request.url.path in _PUBLIC_PATHS:
        return await call_next(request)

    token = request.headers.get("X-Internal-Token")
    if token != _INTERNAL_TOKEN:
        return JSONResponse(
            status_code=403,
            content={"detail": "Invalid or missing internal token."},
        )
    return await call_next(request)
