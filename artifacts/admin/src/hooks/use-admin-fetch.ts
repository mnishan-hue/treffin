import { useCallback } from "react";
import { reportAdminRequestError } from "../lib/admin-events";

// Strip trailing slash once — mirrors lib/api.ts
const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function useAdminFetch() {
  return useCallback(async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
    const resolvedUrl = url.startsWith("/") ? apiOrigin + url : url;
    const method = options?.method?.toUpperCase() ?? "GET";
    const response = await fetch(resolvedUrl, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(method === "GET" ? {} : { "x-admin-csrf": "1" }),
        ...(options?.headers as Record<string, string> | undefined),
      },
    });
    if (response.status === 401) {
      window.dispatchEvent(new Event("admin-session-expired"));
      throw new Error("Session expired. Please log in again.");
    }
    if (!response.ok) {
      const payload = await response.clone().json().catch(() => ({ error: response.statusText }));
      const message = payload.error ?? "Request failed (" + response.status + ")";
      reportAdminRequestError(message);
      throw new Error(message);
    }
    return response;
  }, []);
}