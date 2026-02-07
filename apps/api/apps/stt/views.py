from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.services.svc_client import forward_stt_transcribe


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def transcribe_segment_view(request):
    """
    Accepts an audio file upload, forwards it to the internal FastAPI STT
    service, and returns the transcription result.

    Frontend calls this Django endpoint — never FastAPI directly.
    """
    audio_file = request.FILES.get("audio")
    if not audio_file:
        return Response(
            {"detail": "Missing 'audio' file in request."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    lang = request.query_params.get("lang")  # optional: fr, ar, tn
    result, error = forward_stt_transcribe(audio_file, lang=lang)
    if error:
        return Response(
            {"detail": error},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    return Response(result)
