"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { checkHealth, verifyAuth } from "@/lib/api";
import { clearAuthToken, clearTenantId, getAuthToken, getTenantId, setAuthToken, setTenantId } from "@/lib/auth";

const DEFAULT_DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState(() => (typeof window !== "undefined" ? getAuthToken() || "" : ""));
  const [tenantId, setTenantIdInput] = useState(() => (typeof window !== "undefined" ? getTenantId() || "" : ""));
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [activeSession, setActiveSession] = useState<{ token: string | null; tenantId: string | null }>(() => {
    if (typeof window === "undefined") return { token: null, tenantId: null };
    return { token: getAuthToken(), tenantId: getTenantId() };
  });
  const [tab, setTab] = useState<"demo" | "custom">(() => {
    if (typeof window === "undefined") return "demo";
    const currentToken = getAuthToken();
    const currentTenant = getTenantId();
    if (currentToken || (currentTenant && currentTenant !== DEFAULT_DEMO_TENANT)) {
      return "custom";
    }
    return "demo";
  });

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const isHealthy = await checkHealth();
        if (isMounted) setApiOnline(isHealthy);
      } catch {
        if (isMounted) setApiOnline(false);
      }

      try {
        const status = await verifyAuth();
        if (isMounted) setAuthRequired(status.auth_required);
      } catch {
        if (isMounted) setAuthRequired(true);
      }
    })();

    return () => {
      isMounted = false;
    };
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
      const verified = await verifyAuth();
      if (!tenantId.trim() && verified?.owner_id) {
        setTenantId(verified.owner_id, remember);
      }
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please verify your credentials.";
      setError(msg);
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    clearAuthToken();
    setTenantId(DEFAULT_DEMO_TENANT, true);
    router.push("/");
  };

  const handleDisconnect = () => {
    clearAuthToken();
    clearTenantId();
    setToken("");
    setTenantIdInput("");
    setActiveSession({ token: null, tenantId: null });
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-center items-center p-6 selection:bg-indigo-500/30">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/5 border border-white/10 shadow-2xl hover:bg-white/10 transition-all">
            <Image src="/logo.png" alt="DocuMind" width={140} height={36} priority className="h-8 w-auto object-contain" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Workspace Authentication
          </h1>
          <p className="text-sm text-slate-400">
            Configure tenant isolation and API credentials for DocuMind.
          </p>

          <div className="flex items-center justify-center gap-2 pt-1">
            {apiOnline === true && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Backend Online (port 8888)</span>
              </div>
            )}
            {apiOnline === false && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Icon name="alert-circle" size={13} />
                <span>API Offline (check port 8888)</span>
              </div>
            )}
            {authRequired === false && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Icon name="check-circle" size={13} />
                <span>Reviewer Mode (Auth Optional)</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Session Card if already set */}
        {(activeSession.token || activeSession.tenantId) && (
          <div className="rounded-2xl bg-indigo-950/20 border border-indigo-500/30 p-4 shadow-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold">Active Session</span>
              <p className="text-xs text-slate-300 font-mono truncate max-w-[260px]">
                {activeSession.tenantId ? `Tenant: ${activeSession.tenantId}` : "Custom Bearer Token"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-white/10 transition-all cursor-pointer"
                title="Disconnect workspace session"
              >
                Clear
              </button>
              <Link
                href="/"
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20"
              >
                Enter →
              </Link>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setTab("demo")}
            className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
              tab === "demo" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            Reviewer Demo (1-Click)
          </button>
          <button
            type="button"
            onClick={() => setTab("custom")}
            className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
              tab === "custom" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            Custom Tenant / API Key
          </button>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-2xl bg-[#0D121F] border border-white/10 p-7 shadow-2xl space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed">
              <Icon name="alert-circle" size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {tab === "demo" ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium">
                  <Icon name="shield-check" size={16} />
                  <span>Single-User Reviewer Scope</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connects to the default isolated evaluation database scope with zero manual setup.
                </p>
                <div className="pt-1 font-mono text-[11px] text-slate-500">
                  Tenant ID: <span className="text-slate-300">{DEFAULT_DEMO_TENANT}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDemoAccess}
                className="w-full py-3 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Icon name="check-circle" size={16} />
                <span>Launch Reviewer Workspace</span>
              </button>
            </div>
          ) : (
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
                  Tenant / Owner ID <span className="text-slate-500 font-normal lowercase">(UUID)</span>
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
                    <span>Connect Custom Tenant</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Reviewer Demo Bypass */}
          <div className="pt-3 border-t border-white/5 text-center flex items-center justify-between text-xs text-slate-500">
            <Link href="/" className="hover:text-indigo-400 transition-colors">
              ← Return to Chat
            </Link>
            <Link href="/documents" className="hover:text-indigo-400 transition-colors">
              View Documents Library →
            </Link>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-xs text-slate-500">
          All requests are encrypted with HTTPS and scoped to PostgreSQL tenant databases.
        </p>
      </div>
    </div>
  );
}
