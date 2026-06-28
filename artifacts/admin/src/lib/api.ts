import { getStoredToken } from "./auth";

const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
export const API_BASE = `${apiOrigin}/api`;

const BASE = API_BASE;

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getStoredToken() ?? "";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
