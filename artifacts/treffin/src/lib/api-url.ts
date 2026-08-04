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
