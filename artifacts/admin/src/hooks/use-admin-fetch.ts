import { getStoredToken } from "@/lib/auth";

export function useAdminFetch() {
  return function adminFetch(url: string, options?: RequestInit): Promise<Response> {
    const token = getStoredToken() ?? "";
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
        ...(options?.headers as Record<string, string> | undefined),
      },
    });
  };
}
