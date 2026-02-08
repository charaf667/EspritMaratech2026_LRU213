from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from config.throttles import LoginRateThrottle

from .models import User
from .serializers import CreateUserSerializer, LoginSerializer, UpdateUserSerializer, UserSerializer


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


def _require_admin(request):
    if request.user.role != "admin":
        return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
    return None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def users_list_view(request):
    """GET: list all users. POST: create a new user. Admin only."""
    denied = _require_admin(request)
    if denied:
        return denied

    if request.method == "GET":
        users = User.objects.all().order_by("first_name", "last_name")
        return Response(UserSerializer(users, many=True).data)

    # POST — create user
    serializer = CreateUserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data
    user = User.objects.create_user(
        email=d["email"],
        password=d["password"],
        first_name=d["first_name"],
        last_name=d["last_name"],
        role=d["role"],
    )
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def user_detail_view(request, user_id):
    """GET/PATCH/DELETE a single user. Admin only."""
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(UserSerializer(user).data)

    if request.method == "DELETE":
        if user.id == request.user.id:
            return Response({"detail": "Vous ne pouvez pas supprimer votre propre compte."}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response({"detail": "User deleted."}, status=status.HTTP_200_OK)

    # PATCH — update user
    serializer = UpdateUserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    for attr, value in serializer.validated_data.items():
        setattr(user, attr, value)
    user.save(update_fields=list(serializer.validated_data.keys()))
    return Response(UserSerializer(user).data)
