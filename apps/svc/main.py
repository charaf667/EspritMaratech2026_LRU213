"""
OMNIA — Internal FastAPI service for compute-heavy tasks (STT, routing).
This service is NOT exposed to the frontend. Only Django calls it server-to-server.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

# Load .env from repo root
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

from routers import health, ocr, routing, stt  # noqa: E402
from middleware import verify_internal_token  # noqa: E402

app = FastAPI(
    title="OMNIA Internal Services",
    version="0.1.0",
    docs_url="/docs" if os.environ.get("SVC_DEBUG", "true").lower() in ("true", "1") else None,
)

# Apply internal token verification to all routes except /health
app.middleware("http")(verify_internal_token)

app.include_router(health.router)
app.include_router(stt.router, prefix="/stt", tags=["STT"])
app.include_router(routing.router, prefix="/routing", tags=["Routing"])
app.include_router(ocr.router, prefix="/ocr", tags=["OCR"])


@app.on_event("startup")
async def _preload_models():
    """Preload Whisper model at startup so the first STT request is fast."""
    try:
        stt._get_model()
    except Exception:
        pass  # Model download may fail offline; will retry on first request
