const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "admin@treffin.com";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "treffin2025";
const TOKEN_KEY = "treffin_admin_token";

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeToken(email: string, password: string): Promise<string> {
  return sha256(`${email}:${password}`);
}

export async function getExpectedToken(): Promise<string> {
  return sha256(`${ADMIN_EMAIL}:${ADMIN_PASSWORD}`);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  const stored = getStoredToken();
  if (!stored) return false;
  const expected = await getExpectedToken();
  return stored === expected;
}

export async function login(email: string, password: string): Promise<boolean> {
  const token = await computeToken(email, password);
  const expected = await getExpectedToken();
  if (token === expected) {
    storeToken(token);
    return true;
  }
  return false;
}

export function logout() {
  clearToken();
}
