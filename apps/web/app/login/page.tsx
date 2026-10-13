"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { verifyAuth } from "@/lib/api";
import {
  clearAuthToken,
  clearTenantId,
  getAuthToken,
  getTenantId,
  setAuthToken,
  setTenantId,
} from "@/lib/auth";

const subscribeAuth = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("documind:auth-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("documind:auth-changed", callback);
  };
};

const getStoredToken = () => (typeof window !== "undefined" ? getAuthToken() : null);
const getStoredTenant = () => (typeof window !== "undefined" ? getTenantId() : null);

export default function LoginPage() {
  const router = useRouter();

  const storedToken = useSyncExternalStore(subscribeAuth, getStoredToken, () => null);
  const storedTenant = useSyncExternalStore(subscribeAuth, getStoredTenant, () => null);

  // Controlled form states
  const [tokenInput, setTokenInput] = useState<string | null>(null);
  const [tenantIdInput, setTenantIdInput] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = tokenInput !== null ? tokenInput : (storedToken || "");
  const tenantId = tenantIdInput !== null ? tenantIdInput : (storedTenant || "");

  const activeSession = { token: storedToken, tenantId: storedTenant };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (token.trim()) {
        setAuthToken(token.trim(), remember);
      } else {
        clearAuthToken();
      }

      if (tenantId.trim()) {
        setTenantId(tenantId.trim(), remember);
      } else {
        clearTenantId();
      }

      // Verify credentials with backend
      const verified = await verifyAuth();
      if (!tenantId.trim() && verified?.owner_id) {
        setTenantId(verified.owner_id, remember);
      }

      toast.success("Workspace credentials verified and connected.", {
        id: "auth-success",
      });
      router.push("/");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Authentication failed. Please verify your credentials.";
      setError(msg);
      toast.error(msg, { id: "auth-error" });
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearAuthToken();
    clearTenantId();
    setTokenInput("");
    setTenantIdInput("");
    setError("");
    toast.info("Active workspace session cleared.", { id: "auth-cleared" });
  };

  return (
    <div className="auth-page-container">
      <div className="auth-bg-ambient" />

      <div className="auth-card-wrap">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <Link href="/" className="auth-logo-link" aria-label="DocuMind Home">
            <Image
              src="/logo.png"
              alt="DocuMind"
              width={140}
              height={36}
              priority
              style={{ objectFit: "contain", height: "30px", width: "auto" }}
            />
          </Link>

          <h1 className="auth-title">Connect your workspace</h1>
          <p className="auth-subtitle">
            Enter the credentials and owner scope issued for your DocuMind workspace.
          </p>
        </div>

        {/* Active Session Indicator */}
        {(activeSession.token || activeSession.tenantId) && (
          <div className="auth-session-card">
            <div className="auth-session-meta">
              <span className="auth-session-badge">Active Session</span>
              <span className="auth-session-desc" title={activeSession.tenantId || activeSession.token || ""}>
                {activeSession.tenantId ? `Tenant: ${activeSession.tenantId}` : "Bearer Token Configured"}
              </span>
            </div>
            <div className="auth-session-actions">
              <button
                type="button"
                onClick={handleDisconnect}
                className="auth-session-btn-clear"
                title="Disconnect stored credentials"
              >
                Clear
              </button>
              <Link href="/" className="auth-session-btn-enter">
                Enter →
              </Link>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="auth-card">
          {error && (
            <div className="auth-error-alert" role="alert">
              <Icon name="alert-circle" size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field-group">
                <label htmlFor="token" className="auth-label">
                  API Key or Access Token
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="token"
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Bearer token or API key..."
                    className="auth-input mono"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="auth-input-toggle"
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="auth-field-hint">
                  Supplied via <code>Authorization: Bearer</code> or <code>X-API-Key</code>.
                </p>
              </div>

              <div className="auth-field-group">
                <label htmlFor="tenantId" className="auth-label">
                  Tenant / Owner ID (UUID)
                </label>
                <input
                  id="tenantId"
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantIdInput(e.target.value)}
                  placeholder="Owner UUID"
                  className="auth-input mono"
                />
                <p className="auth-field-hint">
                  Optional. Defaults to credential-bound owner scope via <code>X-Owner-Id</code>.
                </p>
              </div>

              <div className="auth-remember-row">
                <label className="auth-remember-label">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="auth-checkbox"
                  />
                  <span>Remember credentials in browser</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-primary-btn"
              >
                {loading ? (
                  <>
                    <span className="auth-spinner" />
                    <span>Verifying credentials...</span>
                  </>
                ) : (
                  <>
                    <Icon name="shield-check" size={16} />
                    <span>Connect Workspace</span>
                  </>
                )}
              </button>
          </form>

          {/* Quick Footer Links */}
          <div className="auth-footer-nav">
            <Link href="/" className="auth-footer-link">
              ← Return to Chat
            </Link>
            <Link href="/documents" className="auth-footer-link">
              Documents Library →
            </Link>
          </div>
        </div>

        {/* Security Notice */}
        <p className="auth-security-notice">
          All requests are encrypted with HTTPS and scoped to PostgreSQL tenant databases.
        </p>
      </div>
    </div>
  );
}
