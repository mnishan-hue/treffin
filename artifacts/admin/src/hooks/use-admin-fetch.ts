import { getStoredToken } from "@/lib/auth";

// Strip trailing slash once — mirrors lib/api.ts
const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function useAdminFetch() {
  return function adminFetch(url: string, options?: RequestInit): Promise<Response> {
    const token = getStoredToken() ?? "";
    // Relative paths (starting with "/") must be prefixed with the API origin
    // so requests go to treffin-api.onrender.com, not admin.thetreffin.com.
    // Without this every audit-log / appeals call hit the admin's own domain
    // and returned 404.
    const resolvedUrl = url.startsWith("/") ? `${apiOrigin}${url}` : url;
    return fetch(resolvedUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
        ...(options?.headers as Record<string, string> | undefined),
      },
    });
  };
}
