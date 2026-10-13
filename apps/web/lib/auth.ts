/**
 * Client authentication and tenant storage manager for DocuMind.
 */

const TOKEN_KEY = "documind_api_token";
const TENANT_KEY = "documind_tenant_id";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string, remember: boolean = true): void {
  if (typeof window === "undefined") return;
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TENANT_KEY) || sessionStorage.getItem(TENANT_KEY);
}

export function setTenantId(tenantId: string, remember: boolean = true): void {
  if (typeof window === "undefined") return;
  if (remember) {
    localStorage.setItem(TENANT_KEY, tenantId);
  } else {
    sessionStorage.setItem(TENANT_KEY, tenantId);
  }
}

export function clearTenantId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TENANT_KEY);
  sessionStorage.removeItem(TENANT_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const tenantId = getTenantId();
  if (tenantId) {
    headers["X-Owner-Id"] = tenantId;
  }
  return headers;
}

