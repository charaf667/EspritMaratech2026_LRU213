"""
WebAuthn (Passkeys) endpoints — optional passwordless login.
Keeps email/password login unchanged. After WebAuthn verify,
issues the SAME Django session cookie via django.contrib.auth.login().
"""

import base64
import time

from django.conf import settings
from django.contrib.auth import login
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
    AuthenticatorTransport,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes

from config.throttles import LoginRateThrottle
from apps.audit.utils import log_action

from .models import User, WebAuthnCredential
from .serializers import UserSerializer


# ─── Helpers ─────────────────────────────────────────────────

CHALLENGE_SESSION_KEY = "_webauthn_challenge"
CHALLENGE_TS_KEY = "_webauthn_challenge_ts"
CHALLENGE_USER_KEY = "_webauthn_challenge_user_id"
CHALLENGE_MAX_AGE = 300  # 5 minutes


def _store_challenge(session, challenge: bytes, user_id: str | None = None):
    """Store challenge + timestamp in session. Optionally store user_id for login flow."""
    session[CHALLENGE_SESSION_KEY] = bytes_to_base64url(challenge)
    session[CHALLENGE_TS_KEY] = int(time.time())
    if user_id is not None:
        session[CHALLENGE_USER_KEY] = str(user_id)
    session.save()


def _pop_challenge(session, need_user_id=False):
    """
    Retrieve and delete challenge from session.
    Returns (challenge_bytes, user_id_str_or_None) or raises ValueError.
    """
    raw = session.pop(CHALLENGE_SESSION_KEY, None)
    ts = session.pop(CHALLENGE_TS_KEY, None)
    uid = session.pop(CHALLENGE_USER_KEY, None)
    session.save()

    if not raw or not ts:
        raise ValueError("No pending challenge.")

    if int(time.time()) - int(ts) > CHALLENGE_MAX_AGE:
        raise ValueError("Challenge expired.")

    if need_user_id and not uid:
        raise ValueError("No pending challenge.")

    return base64url_to_bytes(raw), uid


def _transport_str_to_enum(t: str):
    """Map transport string to enum, best-effort."""
    mapping = {
        "internal": AuthenticatorTransport.INTERNAL,
        "usb": AuthenticatorTransport.USB,
        "ble": AuthenticatorTransport.BLE,
        "nfc": AuthenticatorTransport.NFC,
        "hybrid": AuthenticatorTransport.HYBRID,
    }
    return mapping.get(t)


# ─── A) POST register/options/ (authenticated) ──────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_options_view(request):
    """Generate WebAuthn registration (creation) options for the authenticated user."""
    user = request.user

    # Exclude already-registered credentials
    existing = WebAuthnCredential.objects.filter(user=user)
    exclude_creds = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
        for c in existing
    ]

    options = generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=str(user.id).encode(),
        user_name=user.email,
        user_display_name=f"{user.first_name} {user.last_name}".strip() or user.email,
        exclude_credentials=exclude_creds,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        timeout=settings.WEBAUTHN_CHALLENGE_TIMEOUT_MS,
    )

    _store_challenge(request.session, options.challenge)

    return Response(
        data=options_to_json(options),
        content_type="application/json",
    )


# ─── B) POST register/verify/ (authenticated) ───────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_verify_view(request):
    """Verify attestation response and store the new credential."""
    user = request.user

    try:
        challenge, _ = _pop_challenge(request.session)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    body = request.body

    try:
        verification = verify_registration_response(
            credential=body,
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
        )
    except Exception as e:
        return Response(
            {"detail": f"Registration verification failed: {e}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cred_id_b64 = bytes_to_base64url(verification.credential_id)

    # Prevent duplicate
    if WebAuthnCredential.objects.filter(credential_id=cred_id_b64).exists():
        return Response(
            {"detail": "Credential already registered."},
            status=status.HTTP_409_CONFLICT,
        )

    cred = WebAuthnCredential.objects.create(
        user=user,
        credential_id=cred_id_b64,
        public_key=verification.credential_public_key,
        sign_count=verification.sign_count,
        aaguid=str(verification.aaguid) if verification.aaguid else None,
    )

    # Audit
    log_action(
        actor=user,
        action="passkey_registered",
        entity_type="webauthn_credential",
        entity_id=cred.id,
        meta={"credential_id_prefix": cred_id_b64[:16]},
    )

    return Response({
        "id": str(cred.id),
        "credential_id": cred_id_b64,
        "created_at": cred.created_at.isoformat() if cred.created_at else None,
    }, status=status.HTTP_201_CREATED)


# ─── C) POST login/options/ (unauthenticated) ───────────────

@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_options_view(request):
    """
    Generate WebAuthn authentication (assertion) options.
    Body: { "email": "user@example.com" }
    Does not leak user existence — always returns 200 with valid options.
    """
    email = (request.data.get("email") or "").strip().lower()

    allow_credentials = []
    user_id_str = None

    if email:
        try:
            user = User.objects.get(email=email)
            creds = WebAuthnCredential.objects.filter(user=user)
            for c in creds:
                transports = []
                if c.transports:
                    for t in c.transports:
                        mapped = _transport_str_to_enum(t)
                        if mapped:
                            transports.append(mapped)
                allow_credentials.append(
                    PublicKeyCredentialDescriptor(
                        id=base64url_to_bytes(c.credential_id),
                        transports=transports if transports else None,
                    )
                )
            user_id_str = str(user.id)
        except User.DoesNotExist:
            pass

    options = generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        allow_credentials=allow_credentials if allow_credentials else None,
        user_verification=UserVerificationRequirement.PREFERRED,
        timeout=settings.WEBAUTHN_CHALLENGE_TIMEOUT_MS,
    )

    _store_challenge(request.session, options.challenge, user_id=user_id_str)

    return Response(
        data=options_to_json(options),
        content_type="application/json",
    )


# ─── D) POST login/verify/ (unauthenticated) ────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_verify_view(request):
    """
    Verify WebAuthn assertion, update sign_count + last_used_at,
    then django.contrib.auth.login() to issue session cookie.
    Returns same shape as password login.
    """
    try:
        challenge, user_id_str = _pop_challenge(request.session, need_user_id=True)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    body = request.body

    # Find the credential being used
    import json
    try:
        assertion_data = json.loads(body)
    except json.JSONDecodeError:
        return Response({"detail": "Invalid JSON."}, status=status.HTTP_400_BAD_REQUEST)

    raw_id_b64 = assertion_data.get("rawId") or assertion_data.get("id", "")

    try:
        cred = WebAuthnCredential.objects.select_related("user").get(
            credential_id=raw_id_b64,
            user_id=user_id_str,
        )
    except WebAuthnCredential.DoesNotExist:
        return Response(
            {"detail": "Invalid credentials."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        verification = verify_authentication_response(
            credential=body,
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            credential_public_key=bytes(cred.public_key),
            credential_current_sign_count=cred.sign_count,
        )
    except Exception as e:
        return Response(
            {"detail": f"Authentication failed: {e}"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Update credential
    cred.sign_count = verification.new_sign_count
    cred.last_used_at = timezone.now()
    cred.save(update_fields=["sign_count", "last_used_at"])

    user = cred.user

    if not user.is_active:
        return Response(
            {"detail": "Invalid credentials."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Issue Django session — same as password login
    login(request, user)

    # Audit
    log_action(
        actor=user,
        action="passkey_login_success",
        entity_type="webauthn_credential",
        entity_id=cred.id,
    )

    return Response(UserSerializer(user).data)


# ─── E) GET credentials/ (authenticated) ────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def credentials_list_view(request):
    """List the authenticated user's registered passkeys."""
    creds = WebAuthnCredential.objects.filter(user=request.user).order_by("-created_at")
    data = [
        {
            "id": str(c.id),
            "credential_id": c.credential_id,
            "sign_count": c.sign_count,
            "transports": c.transports,
            "aaguid": c.aaguid,
            "created_at": c.created_at.isoformat(),
            "last_used_at": c.last_used_at.isoformat() if c.last_used_at else None,
        }
        for c in creds
    ]
    return Response(data)


# ─── F) DELETE credentials/{id}/ (authenticated) ────────────

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def credentials_delete_view(request, credential_id):
    """Remove a passkey. Users can only delete their own credentials."""
    try:
        cred = WebAuthnCredential.objects.get(id=credential_id, user=request.user)
    except WebAuthnCredential.DoesNotExist:
        return Response(
            {"detail": "Credential not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    cred_uuid = cred.id
    cred_id_prefix = cred.credential_id[:16]
    cred.delete()

    # Audit
    log_action(
        actor=request.user,
        action="passkey_removed",
        entity_type="webauthn_credential",
        entity_id=cred_uuid,
        meta={"credential_id_prefix": cred_id_prefix},
    )

    return Response({"detail": "Credential removed."}, status=status.HTTP_200_OK)
