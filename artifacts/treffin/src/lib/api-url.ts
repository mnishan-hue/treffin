import { getToken } from "@/lib/auth-client";

/**
 * Returns the full URL for an API path.
 *
 * In production (Vercel frontend + Render backend) VITE_API_BASE_URL is set to
 * the Render service root, e.g. "https://treffin-api.onrender.com".
 * In development the var is empty and paths stay root-relative so the Vite dev
 * server (or a local Express server) handles them on the same origin.
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function getApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_ORIGIN ? `${API_ORIGIN}${normalized}` : normalized;
}

/**
 * Fetch an API route with both supported session transports. Cross-site cookies
 * remain primary, while the short-lived bearer token keeps authenticated
 * actions working in browsers that block third-party cookies.
 */
export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(/^https?:\/\//i.test(path) ? path : getApiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
}
