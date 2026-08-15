const AUTH_ENTRY_PATHS = new Set(["/sign-in", "/sign-up", "/forgot-password", "/reset-password"]);

export function safeAuthReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://treffin.local");
    if (parsed.origin !== "https://treffin.local" || AUTH_ENTRY_PATHS.has(parsed.pathname)) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function signInPathFor(location: string): string {
  const returnTo = safeAuthReturnPath(location);
  return `/sign-in?next=${encodeURIComponent(returnTo)}`;
}