const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export async function hasAdminSession(): Promise<boolean> {
  try {
    const response = await fetch(`${apiOrigin}/api/admin/session`, { credentials: "include" });
    return response.ok;
  } catch {
    return false;
  }
}

export type AdminLoginResult =
  | { ok: true }
  | { ok: false; error: string };

export async function login(email: string, password: string): Promise<AdminLoginResult> {
  try {
    const response = await fetch(`${apiOrigin}/api/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      return {
        ok: false,
        error: response.status === 401
          ? "Invalid email or password."
          : (body?.error ?? "Admin sign-in failed. Please try again."),
      };
    }

    // Do not enter the admin shell until the browser proves it stored and can
    // return the HttpOnly cookie. This catches cross-site cookie policy issues
    // immediately instead of producing a dashboard full of 401 responses.
    if (!(await hasAdminSession())) {
      return {
        ok: false,
        error: "Sign-in succeeded, but the secure admin session cookie was blocked. Check the API domain and cookie deployment settings.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Cannot reach the admin API. Check the API deployment and try again." };
  }
}
export async function logout(): Promise<void> {
  try {
    await fetch(`${apiOrigin}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "x-admin-csrf": "1" },
    });
  } catch {
    // The local UI still returns to login when the API is unavailable.
  }
}