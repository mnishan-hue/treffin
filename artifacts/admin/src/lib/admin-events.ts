export const ADMIN_REQUEST_ERROR_EVENT = "admin-request-error";

let lastMessage = "";
let lastReportedAt = 0;

/** Surfaces API failures once instead of leaving admin controls silently stuck. */
export function reportAdminRequestError(message: string): void {
  const now = Date.now();
  if (message === lastMessage && now - lastReportedAt < 60_000) return;
  lastMessage = message;
  lastReportedAt = now;
  window.dispatchEvent(new CustomEvent(ADMIN_REQUEST_ERROR_EVENT, { detail: { message } }));
}