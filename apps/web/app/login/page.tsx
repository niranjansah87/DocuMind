"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { verifyAuth } from "@/lib/api";
import { clearAuthToken, clearTenantId, getAuthToken, getTenantId, setAuthToken, setTenantId } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState(() => (typeof window !== "undefined" ? getAuthToken() || "" : ""));
  const [tenantId, setTenantIdInput] = useState(() => (typeof window !== "undefined" ? getTenantId() || "" : ""));
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);

  useEffect(() => {
    // Check backend auth requirement
    void (async () => {
      try {
        const status = await verifyAuth();
        setAuthRequired(status.auth_required);
      } catch {
        // If 401, auth is required
        setAuthRequired(true);
      }
    })();
  }, []);

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
      await verifyAuth();
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please verify your credentials.";
      setError(msg);
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    clearAuthToken();
    clearTenantId();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-center items-center p-6 selection:bg-indigo-500/30">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/5 border border-white/10 shadow-2xl">
            <Image src="/logo.png" alt="DocuMind" width={140} height={36} priority className="h-8 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Workspace Authentication
          </h1>
          <p className="text-sm text-slate-400">
            Sign in to access your document repository and grounded agent.
          </p>
          {authRequired === false && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Icon name="check-circle" size={13} />
              <span>Reviewer mode active (Auth optional)</span>
            </div>
          )}
        </div>

        {/* Auth Form Card */}
        <div className="rounded-2xl bg-[#0D121F] border border-white/10 p-8 shadow-2xl space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed animate-in fade-in duration-200">
              <Icon name="alert-circle" size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="token" className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                API Key or Access Token
              </label>
              <div className="relative">
                <input
                  id="token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Bearer token or API key..."
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Supplied via <code className="text-slate-400">Authorization: Bearer</code> or <code className="text-slate-400">X-API-Key</code>.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="tenantId" className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                Tenant / Owner ID <span className="text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <input
                id="tenantId"
                type="text"
                value={tenantId}
                onChange={(e) => setTenantIdInput(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000001"
                className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Enforces multi-tenant isolation via <code className="text-slate-400">X-Owner-Id</code>.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-black/40 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-400">Remember credentials</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <Icon name="shield-check" size={16} />
                  <span>Connect to Workspace</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Reviewer Demo Bypass */}
          <div className="pt-4 border-t border-white/5 text-center">
            <button
              type="button"
              onClick={handleDemoAccess}
              className="text-xs text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              Continue with Single-User Demo Scope →
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-xs text-slate-500">
          All requests are encrypted with HTTPS and scoped to tenant databases.
        </p>
      </div>
    </div>
  );
}
