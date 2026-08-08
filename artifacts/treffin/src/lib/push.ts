/**
 * Web Push helpers for the Treffin frontend.
 *
 * Usage:
 *   import { enablePushNotifications } from "@/lib/push";
 *   const granted = await enablePushNotifications();
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

/**
 * The Push API needs the VAPID public key as a Uint8Array.
 * Convert from base64url (the standard VAPID wire format) to Uint8Array.
 */
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Request notification permission, subscribe this device via the Web Push API,
 * and register the resulting subscription with the Treffin server.
 *
 * Returns `true` if the user granted permission AND the subscription was saved
 * successfully. Returns `false` on any failure (permission denied, browser
 * doesn't support Push, VAPID key missing, network error, etc.).
 */
export async function enablePushNotifications(): Promise<boolean> {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !VAPID_PUBLIC_KEY
  ) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Re-use an existing subscription if one already exists for this device
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }

    const res = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });

    return res.ok;
  } catch (err) {
    console.error("[push] enablePushNotifications failed", err);
    return false;
  }
}

/**
 * Unsubscribe this device from push notifications and remove the subscription
 * from the server. Safe to call even if not subscribed.
 */
export async function disablePushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});

    await sub.unsubscribe();
  } catch (err) {
    console.error("[push] disablePushNotifications failed", err);
  }
}
