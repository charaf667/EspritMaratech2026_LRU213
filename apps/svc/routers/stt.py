"""
Speech-to-Text service endpoint using faster-whisper (CTranslate2).
"""

import logging
import os
import tempfile

from fastapi import APIRouter, File, Query, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Model singleton ──────────────────────────────────────────────

_model = None
_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        logger.info("Loading Whisper model: %s", _MODEL_SIZE)
        _model = WhisperModel(
            _MODEL_SIZE,
            device="cpu",
            compute_type="int8",
        )
        logger.info("Whisper model loaded successfully")
    return _model


@router.post("/transcribe-segment")
async def transcribe_segment(
    audio: UploadFile = File(...),
    lang: str | None = Query(None, description="Language hint: fr, ar, tn. 'tn' maps to 'ar' for Whisper."),
):
    """
    Accept an audio file, convert to 16kHz WAV, run Whisper transcription.
    Returns text, confidence, segments, and detected language.
    """
    raw_bytes = await audio.read()

    # Save to temp file
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_in:
        tmp_in.write(raw_bytes)
        tmp_in_path = tmp_in.name

    wav_path = None
    try:
        # Convert to 16kHz mono WAV using pydub (requires ffmpeg)
        from pydub import AudioSegment

        audio_seg = AudioSegment.from_file(tmp_in_path)
        audio_seg = audio_seg.set_frame_rate(16000).set_channels(1)
        wav_path = tmp_in_path + ".wav"
        audio_seg.export(wav_path, format="wav")

        # Map locale hint to Whisper language code
        whisper_lang = None
        if lang:
            lang_map = {"fr": "fr", "ar": "ar", "tn": "ar"}  # Tunisian → Arabic
            whisper_lang = lang_map.get(lang)

        # Run transcription
        model = _get_model()
        segments_iter, info = model.transcribe(
            wav_path,
            language=whisper_lang,  # None = auto-detect
            beam_size=1,
            vad_filter=True,
        )

        segments = []
        full_text_parts = []
        for seg in segments_iter:
            segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
                "avg_logprob": round(seg.avg_logprob, 4),
            })
            full_text_parts.append(seg.text.strip())

        full_text = " ".join(full_text_parts)
        avg_confidence = None
        if segments:
            import math
            avg_logprob = sum(s["avg_logprob"] for s in segments) / len(segments)
            avg_confidence = round(math.exp(avg_logprob), 4)

        return {
            "text": full_text,
            "confidence": avg_confidence,
            "segments": segments,
            "language": info.language,
        }

    except Exception as e:
        logger.exception("STT transcription failed: %s", e)
        return {
            "text": "",
            "confidence": None,
            "segments": [],
            "language": None,
            "error": str(e),
        }
    finally:
        # Cleanup temp files
        try:
            os.unlink(tmp_in_path)
        except OSError:
            pass
        if wav_path:
            try:
                os.unlink(wav_path)
            except OSError:
                pass
