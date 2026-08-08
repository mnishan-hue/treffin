const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export async function hasAdminSession(): Promise<boolean> {
  try {
    const response = await fetch(`${apiOrigin}/api/admin/session`, { credentials: "include" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiOrigin}/api/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return response.ok;
  } catch {
    return false;
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