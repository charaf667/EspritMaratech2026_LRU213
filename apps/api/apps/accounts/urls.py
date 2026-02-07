from django.urls import path

from . import views
from . import webauthn_views

urlpatterns = [
    path("csrf/", views.csrf_view, name="auth-csrf"),
    path("login/", views.login_view, name="auth-login"),
    path("logout/", views.logout_view, name="auth-logout"),
    path("me/", views.me_view, name="auth-me"),
    path("users/", views.users_list_view, name="auth-users"),
    # WebAuthn (Passkeys)
    path("webauthn/register/options/", webauthn_views.register_options_view, name="webauthn-register-options"),
    path("webauthn/register/verify/", webauthn_views.register_verify_view, name="webauthn-register-verify"),
    path("webauthn/login/options/", webauthn_views.login_options_view, name="webauthn-login-options"),
    path("webauthn/login/verify/", webauthn_views.login_verify_view, name="webauthn-login-verify"),
    path("webauthn/credentials/", webauthn_views.credentials_list_view, name="webauthn-credentials-list"),
    path("webauthn/credentials/<uuid:credential_id>/", webauthn_views.credentials_delete_view, name="webauthn-credentials-delete"),
]
