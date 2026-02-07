from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from apps.services.svc_client import forward_ocr_extract


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def extract_cin_view(request):
    """
    POST /api/ocr/extract-cin/
    Accepts an image file, forwards to FastAPI OCR service,
    returns extracted CIN fields.
    """
    image = request.FILES.get("image")
    if not image:
        return Response(
            {"detail": "No image file provided."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if image.content_type not in allowed_types:
        return Response(
            {"detail": f"Unsupported image type: {image.content_type}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result, error = forward_ocr_extract(image)
    if error:
        return Response({"detail": error}, status=status.HTTP_502_BAD_GATEWAY)

    return Response(result)
