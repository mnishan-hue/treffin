import { authenticatedFetch } from "@/lib/api-url";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function applicationServerKeysMatch(
  existing: ArrayBuffer | null,
  expected: Uint8Array,
): boolean {
  if (!existing) return false;
  const current = new Uint8Array(existing);
  return current.length === expected.length && current.every((value, index) => value === expected[index]);
}

export function isPushAvailable(): boolean {
  return typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window
    && Boolean(VAPID_PUBLIC_KEY);
}

/**
 * Request permission, create (or repair) the browser subscription, and persist
 * it against the currently authenticated Treffin account.
 */
export async function enablePushNotifications(): Promise<boolean> {
  if (!isPushAvailable() || !VAPID_PUBLIC_KEY) return false;

  try {
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    const expectedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    let subscription = await registration.pushManager.getSubscription();

    // A VAPID key rotation invalidates an otherwise present browser
    // subscription. Replace it before syncing with the API.
    if (
      subscription
      && !applicationServerKeysMatch(subscription.options.applicationServerKey, expectedKey)
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedKey.buffer as ArrayBuffer,
      });
    }

    const response = await authenticatedFetch("/api/push/subscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    return response.ok;
  } catch (error) {
    console.error("[push] enablePushNotifications failed", error);
    return false;
  }
}

/** Mobile browsers require service-worker notifications; `new Notification()`
 * is not supported by Android Chrome and installed iOS web apps. */
export async function showLocalNotification(
  title: string,
  options: NotificationOptions = {},
): Promise<boolean> {
  if (
    typeof window === "undefined"
    || !("Notification" in window)
    || !("serviceWorker" in navigator)
    || Notification.permission !== "granted"
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const suppliedData = options.data && typeof options.data === "object"
      ? options.data as Record<string, unknown>
      : {};
    await registration.showNotification(title, {
      icon: `${import.meta.env.BASE_URL}pwa-icon-192.png`,
      badge: `${import.meta.env.BASE_URL}pwa-icon-192.png`,
      ...options,
      data: { url: "/notifications", ...suppliedData },
    });
    return true;
  } catch (error) {
    console.error("[push] local notification failed", error);
    return false;
  }
}

export async function disablePushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await authenticatedFetch("/api/push/unsubscribe", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);

    await subscription.unsubscribe();
  } catch (error) {
    console.error("[push] disablePushNotifications failed", error);
  }
}