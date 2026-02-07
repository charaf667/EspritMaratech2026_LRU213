"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import {
  USE_API, fetchCsrfToken, apiUserToUser,
  apiWebAuthnLoginOptions, apiWebAuthnLoginVerify,
  base64urlToBuffer, bufferToBase64url,
} from "@/lib/api";
import { Button, Input } from "@/components/ds";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { LogIn, Fingerprint } from "lucide-react";

export default function LoginPage() {
  const { t } = useI18n();
  const { login, loginWithUser, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [webauthnSupported, setWebauthnSupported] = useState(false);

  // Detect WebAuthn support
  useEffect(() => {
    setWebauthnSupported(
      typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === "function"
    );
  }, []);

  // Already logged in — redirect to app
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/app");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await login(email, password);
    setLoading(false);

    if (success) {
      router.push("/app");
    } else {
      setError(t("loginError"));
    }
  };

  const handlePasskeyLogin = useCallback(async () => {
    if (!email.trim()) {
      setError(t("loginError"));
      return;
    }
    setError("");
    setPasskeyLoading(true);

    try {
      // 1. Ensure CSRF cookie
      await fetchCsrfToken();

      // 2. Get assertion options from server
      const { data: optionsRaw, error: optErr } = await apiWebAuthnLoginOptions(email.trim());
      if (optErr || !optionsRaw) {
        setError(t("passkeyError"));
        setPasskeyLoading(false);
        return;
      }

      // Parse if string, otherwise use as-is
      const options = typeof optionsRaw === "string" ? JSON.parse(optionsRaw) : optionsRaw;

      // 3. Build publicKey options with ArrayBuffer conversions
      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification: options.userVerification || "preferred",
        allowCredentials: (options.allowCredentials || []).map((c: { id: string; type: string; transports?: string[] }) => ({
          id: base64urlToBuffer(c.id),
          type: c.type,
          transports: c.transports,
        })),
      };

      // 4. Prompt user
      const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null;
      if (!credential) {
        setError(t("passkeyCancelled"));
        setPasskeyLoading(false);
        return;
      }

      // 5. Serialize assertion response
      const response = credential.response as AuthenticatorAssertionResponse;
      const assertionJSON = JSON.stringify({
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: bufferToBase64url(response.authenticatorData),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          signature: bufferToBase64url(response.signature),
          userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
        },
      });

      // 6. Verify on server
      const { data, error: verifyErr } = await apiWebAuthnLoginVerify(assertionJSON);
      if (verifyErr || !data) {
        setError(t("passkeyError"));
        setPasskeyLoading(false);
        return;
      }

      // 7. Set user in auth context and redirect
      loginWithUser(apiUserToUser(data));
      router.push("/app");
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError(t("passkeyCancelled"));
      } else {
        setError(t("passkeyError"));
      }
    } finally {
      setPasskeyLoading(false);
    }
  }, [email, t, loginWithUser, router]);

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg-secondary)]">
      {/* Top bar */}
      <div className="flex justify-end p-[var(--space-4)]">
        <LanguageSwitcher />
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-[var(--space-4)] pb-[var(--space-8)]">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="text-center mb-[var(--space-8)]">
            <div className="w-16 h-16 mx-auto mb-[var(--space-4)] rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] text-2xl font-bold">
              O
            </div>
            <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--text-primary)]">
              {t("loginTitle")}
            </h1>
            <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-1">
              {t("loginSubtitle")}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-[var(--surface-raised)] rounded-[var(--radius-xl)] shadow-[var(--elevation-3)] p-[var(--space-6)] space-y-[var(--space-4)]"
          >
            <Input
              label={t("email")}
              name="email"
              type="email"
              autoComplete="email webauthn"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sara@omnia.org"
            />

            <Input
              label={t("password")}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <p className="text-[var(--text-sm)] text-[var(--critical)]" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading || passkeyLoading}
              icon={<LogIn size={20} />}
              className="w-full"
            >
              {loading ? t("loading") : t("loginButton")}
            </Button>

            {/* Passkey login */}
            {USE_API && webauthnSupported && (
              <>
                <div className="flex items-center gap-[var(--space-3)]">
                  <div className="flex-1 h-px bg-[var(--border-default)]" />
                  <span className="text-[var(--text-xs)] text-[var(--text-tertiary)]">
                    {t("loginDemo").includes("Demo") ? "ou" : "أو"}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border-default)]" />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={passkeyLoading || loading || !email.trim()}
                  icon={<Fingerprint size={20} />}
                  className="w-full"
                  onClick={handlePasskeyLogin}
                >
                  {passkeyLoading ? t("loading") : t("loginWithPasskey")}
                </Button>
              </>
            )}

            <p className="text-[var(--text-xs)] text-[var(--text-tertiary)] text-center mt-[var(--space-2)]">
              {t("loginDemo")}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
