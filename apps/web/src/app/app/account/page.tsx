"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import {
  USE_API, fetchCsrfToken,
  apiWebAuthnRegisterOptions, apiWebAuthnRegisterVerify,
  apiWebAuthnCredentialsList, apiWebAuthnCredentialDelete,
  base64urlToBuffer, bufferToBase64url,
  type WebAuthnCredentialInfo,
} from "@/lib/api";
import { Card, CardHeader, Button, Badge } from "@/components/ds";
import {
  Fingerprint, Plus, Trash2, Clock, ShieldCheck, ChevronLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();

  const [credentials, setCredentials] = useState<WebAuthnCredentialInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [webauthnSupported, setWebauthnSupported] = useState(false);

  useEffect(() => {
    setWebauthnSupported(
      typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === "function"
    );
  }, []);

  const loadCredentials = useCallback(async () => {
    if (!USE_API) return;
    setLoading(true);
    const { data } = await apiWebAuthnCredentialsList();
    if (data) setCredentials(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const handleRegister = useCallback(async () => {
    setMessage(null);
    setRegisterLoading(true);

    try {
      await fetchCsrfToken();

      // 1. Get registration options
      const { data: optionsRaw, error: optErr } = await apiWebAuthnRegisterOptions();
      if (optErr || !optionsRaw) {
        setMessage({ type: "error", text: t("passkeyRegisterError") });
        setRegisterLoading(false);
        return;
      }

      const options = typeof optionsRaw === "string" ? JSON.parse(optionsRaw) : optionsRaw;

      // 2. Build publicKey creation options
      const publicKey: PublicKeyCredentialCreationOptions = {
        rp: options.rp,
        user: {
          id: base64urlToBuffer(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        challenge: base64urlToBuffer(options.challenge),
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout,
        excludeCredentials: (options.excludeCredentials || []).map((c: { id: string; type: string; transports?: string[] }) => ({
          id: base64urlToBuffer(c.id),
          type: c.type,
          transports: c.transports,
        })),
        authenticatorSelection: options.authenticatorSelection,
        attestation: options.attestation || "none",
      };

      // 3. Prompt user
      const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null;
      if (!credential) {
        setMessage({ type: "error", text: t("passkeyCancelled") });
        setRegisterLoading(false);
        return;
      }

      // 4. Serialize attestation response
      const response = credential.response as AuthenticatorAttestationResponse;
      const attestationJSON = JSON.stringify({
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: bufferToBase64url(response.attestationObject),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
        },
      });

      // 5. Verify on server
      const { error: verifyErr } = await apiWebAuthnRegisterVerify(attestationJSON);
      if (verifyErr) {
        setMessage({ type: "error", text: t("passkeyRegisterError") });
        setRegisterLoading(false);
        return;
      }

      setMessage({ type: "success", text: t("passkeyRegistered") });
      await loadCredentials();
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setMessage({ type: "error", text: t("passkeyCancelled") });
      } else {
        setMessage({ type: "error", text: t("passkeyRegisterError") });
      }
    } finally {
      setRegisterLoading(false);
    }
  }, [t, loadCredentials]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t("passkeyRemoveConfirm"))) return;
    setMessage(null);
    const { error } = await apiWebAuthnCredentialDelete(id);
    if (error) {
      setMessage({ type: "error", text: error });
    } else {
      setMessage({ type: "success", text: t("passkeyRemoved") });
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    }
  }, [t]);

  return (
    <div className="flex-1 overflow-y-auto p-[var(--space-4)] max-w-2xl mx-auto w-full space-y-[var(--space-6)]">
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer min-h-[var(--touch-target-min)]"
      >
        <ChevronLeft size={16} className="rtl:rotate-180" />
        {t("back")}
      </button>

      <h1 className="text-xl font-semibold text-[var(--text-primary)]">
        {t("accountSettings")}
      </h1>

      {/* User info */}
      {user && (
        <Card>
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="w-12 h-12 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] font-semibold text-lg shrink-0">
              {user.firstName?.[0] ?? user.email[0].toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-[var(--text-tertiary)]">{user.email}</p>
              <Badge variant={user.role === "admin" ? "info" : "neutral"}>
                {user.role}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Passkeys section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Fingerprint size={18} className="text-[var(--primary)]" />
              {t("passkeys")}
            </h2>
            {USE_API && webauthnSupported && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={16} />}
                disabled={registerLoading}
                onClick={handleRegister}
              >
                {registerLoading ? t("loading") : t("passkeyAdd")}
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Status message */}
        {message && (
          <div
            role="alert"
            aria-live="polite"
            className={`mb-[var(--space-3)] p-[var(--space-3)] rounded-[var(--radius-md)] text-sm font-medium ${
              message.type === "success"
                ? "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]"
                : "bg-[color-mix(in_srgb,var(--critical)_12%,transparent)] text-[var(--critical)]"
            }`}
          >
            {message.text}
          </div>
        )}

        {!USE_API && (
          <p className="text-sm text-[var(--text-tertiary)] py-2">
            {t("passkeyUnsupported")}
          </p>
        )}

        {!webauthnSupported && USE_API && (
          <p className="text-sm text-[var(--text-tertiary)] py-2">
            {t("passkeyUnsupported")}
          </p>
        )}

        {/* Credentials list */}
        {loading ? (
          <div className="py-4 text-sm text-[var(--text-tertiary)] text-center">
            {t("loading")}
          </div>
        ) : credentials.length === 0 ? (
          <div className="py-4 text-sm text-[var(--text-tertiary)] text-center flex flex-col items-center gap-2">
            <ShieldCheck size={32} className="text-[var(--text-tertiary)] opacity-40" />
            {t("passkeyNone")}
          </div>
        ) : (
          <div className="space-y-[var(--space-2)]">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
              >
                <div className="flex items-center gap-[var(--space-3)] flex-1 min-w-0">
                  <Fingerprint size={20} className="text-[var(--primary)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate font-mono">
                      {cred.credential_id.substring(0, 20)}…
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--text-tertiary)]">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {t("passkeyCreated")}: {new Date(cred.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        {t("passkeyLastUsed")}: {cred.last_used_at ? new Date(cred.last_used_at).toLocaleDateString() : t("passkeyNever")}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={16} />}
                  onClick={() => handleDelete(cred.id)}
                  aria-label={t("passkeyRemove")}
                  className="text-[var(--critical)] shrink-0"
                >
                  {t("passkeyRemove")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
