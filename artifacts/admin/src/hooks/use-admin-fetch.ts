// Strip trailing slash once — mirrors lib/api.ts
const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function useAdminFetch() {
  return function adminFetch(url: string, options?: RequestInit): Promise<Response> {
    const resolvedUrl = url.startsWith("/") ? `${apiOrigin}${url}` : url;
    const method = options?.method?.toUpperCase() ?? "GET";
    return fetch(resolvedUrl, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(method === "GET" ? {} : { "x-admin-csrf": "1" }),
        ...(options?.headers as Record<string, string> | undefined),
      },
    });
  };
}