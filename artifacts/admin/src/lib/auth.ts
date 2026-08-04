const TOKEN_KEY = "treffin_admin_token";

const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Returns true if a session token is present locally. */
export function isAuthenticated(): boolean {
  return !!getStoredToken();
}

/**
 * POST credentials to the server's /api/admin/login endpoint.
 * The server verifies bcrypt (or plain-password fallback) and returns
 * the session token — no credential comparison happens on the client.
 */
export async function login(email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiOrigin}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return false;
    const { token } = await res.json() as { token: string };
    if (!token) return false;
    storeToken(token);
    return true;
  } catch {
    return false;
  }
}

export function logout() {
  clearToken();
}
