from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from config.throttles import LoginRateThrottle

from .serializers import LoginSerializer, UserSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_view(request):
    """
    Return a CSRF token and set the csrftoken cookie.
    Frontend must call this before making unsafe requests.
    """
    token = get_token(request)
    return Response({"csrfToken": token})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    """
    Authenticate via email + password. Sets session cookie on success.
    """
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        request,
        username=serializer.validated_data["email"],
        password=serializer.validated_data["password"],
    )
    if user is None:
        return Response(
            {"detail": "Invalid credentials."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    login(request, user)
    return Response(UserSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Log out the current session."""
    logout(request)
    return Response({"detail": "Logged out."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return current authenticated user info."""
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users_list_view(request):
    """List all users. Admin only."""
    from apps.common.permissions import IsAdmin

    if request.user.role != "admin":
        return Response(
            {"detail": "Admin access required."},
            status=status.HTTP_403_FORBIDDEN,
        )

    from .models import User

    users = User.objects.all().order_by("first_name", "last_name")
    return Response(UserSerializer(users, many=True).data)
