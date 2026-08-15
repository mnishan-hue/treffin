import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/lib/auth-client";
import { Bell, Download, Share, X } from "lucide-react";
import {
  enablePushNotifications,
  isPushAvailable,
  showLocalNotification,
} from "@/lib/push";

const INSTALL_DISMISSED_KEY = "treffin_pwa_dismissed_at";
const INSTALL_ACCEPTED_KEY = "treffin_pwa_installed";
const PUSH_KEY = "treffin_push_prompted";
const COOKIE_KEY = "treffin_cookie_consent";
const COOKIE_EVENT = "treffin:cookie-consent";
const AUTH_ROUTES = ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/onboarding"];
const INSTALL_MIN_MS = 30_000;
const BETWEEN_MS = 1_500;
const INSTALL_REPROMPT_MS = 7 * 24 * 60 * 60 * 1_000;

type BannerType = "install" | "push";
type InstallPlatform = "android" | "ios" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function runningStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

function installWasRecentlyDismissed(): boolean {
  const raw = localStorage.getItem(INSTALL_DISMISSED_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) {
    localStorage.removeItem(INSTALL_DISMISSED_KEY);
    return false;
  }
  return Date.now() - dismissedAt < INSTALL_REPROMPT_MS;
}

/**
 * Owns the post-login install/notification sequence. Only one card can be
 * visible. On phones, install comes first; notification permission is offered
 * after Treffin is launched in standalone mode.
 */
export function BannerQueue() {
  const [location] = useLocation();
  const { isSignedIn, isLoaded } = useSession();
  const [current, setCurrent] = useState<BannerType | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installReady, setInstallReady] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<InstallPlatform>(null);
  const [standalone] = useState(runningStandalone);
  const [cookieHandled, setCookieHandled] = useState(() => Boolean(localStorage.getItem(COOKIE_KEY)));
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const appEntryTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLandingPage = AUTH_ROUTES.some((route) => location === route || location.startsWith("/sign-"));
  const shouldShow = isLoaded && isSignedIn && !isLandingPage && cookieHandled;

  const isNeeded = useCallback((type: BannerType): boolean => {
    if (type === "install") {
      return !standalone
        && installReady
        && !localStorage.getItem(INSTALL_ACCEPTED_KEY)
        && !installWasRecentlyDismissed();
    }

    const previousPushState = localStorage.getItem(PUSH_KEY);
    const canRetryLegacyAttempt = previousPushState === "asked";
    return standalone
      && isPushAvailable()
      && Notification.permission === "default"
      && (!previousPushState || canRetryLegacyAttempt);
  }, [installReady, standalone]);

  const schedule = useCallback((type: BannerType | null, delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!type) {
      setCurrent(null);
      return;
    }
    timerRef.current = setTimeout(() => setCurrent(type), delay);
  }, []);

  const advance = useCallback((from: BannerType) => {
    const order: BannerType[] = ["install", "push"];
    const next = order.slice(order.indexOf(from) + 1).find(isNeeded) ?? null;
    schedule(next, BETWEEN_MS);
  }, [isNeeded, schedule]);

  useEffect(() => {
    const handleConsent = () => setCookieHandled(Boolean(localStorage.getItem(COOKIE_KEY)));
    window.addEventListener(COOKIE_EVENT, handleConsent);
    window.addEventListener("storage", handleConsent);
    return () => {
      window.removeEventListener(COOKIE_EVENT, handleConsent);
      window.removeEventListener("storage", handleConsent);
    };
  }, []);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios && !standalone) {
      setInstallPlatform("ios");
      setInstallReady(true);
    }

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setInstallPlatform("android");
      setInstallReady(true);
    };
    const installed = () => {
      localStorage.setItem(INSTALL_ACCEPTED_KEY, "1");
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
      setCurrent(null);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, [standalone]);

  useEffect(() => {
    if (!shouldShow) {
      schedule(null, 0);
      return;
    }

    const first: BannerType | null = isNeeded("install")
      ? "install"
      : isNeeded("push") ? "push" : null;
    const elapsed = Date.now() - appEntryTime.current;
    const delay = first === "install"
      ? Math.max(BETWEEN_MS, INSTALL_MIN_MS - elapsed)
      : BETWEEN_MS;
    schedule(first, delay);
  }, [isNeeded, schedule, shouldShow]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (!shouldShow || !current) return null;

  if (current === "push") {
    const dismiss = (permanent: boolean) => {
      if (permanent) localStorage.setItem(PUSH_KEY, "dismissed");
      setPushError("");
      advance("push");
    };

    const enable = async () => {
      setPushBusy(true);
      setPushError("");
      const enabled = await enablePushNotifications();
      setPushBusy(false);

      if (enabled) {
        localStorage.setItem(PUSH_KEY, "enabled");
        await showLocalNotification("Treffin notifications enabled!", {
          body: "You’ll be notified about replies, debate updates, and reputation changes.",
          tag: "treffin-push-enabled",
          data: { url: "/notifications" },
        });
        advance("push");
        return;
      }

      if (Notification.permission === "denied") {
        localStorage.setItem(PUSH_KEY, "denied");
        advance("push");
      } else {
        setPushError("Notifications could not be enabled. Check your connection and try again.");
      }
    };

    return (
      <div role="dialog" aria-label="Enable Treffin notifications" style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))", right: 16, width: "min(320px, calc(100vw - 32px))", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 16, padding: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 9999 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "hsl(var(--primary)/0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Bell size={20} style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>Stay in the loop</p>
            <p style={{ margin: "4px 0 12px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>Get notified about debate replies, new reputation, and trending topics.</p>
            {pushError && <p role="alert" style={{ margin: "0 0 10px", fontSize: 12, color: "hsl(var(--destructive))" }}>{pushError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={pushBusy} onClick={() => dismiss(true)} style={{ flex: 1, background: "none", border: "1px solid hsl(var(--border))", borderRadius: 8, padding: "8px 0", fontSize: 13, color: "hsl(var(--muted-foreground))", cursor: "pointer" }}>Not now</button>
              <button disabled={pushBusy} onClick={enable} style={{ flex: 1, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: pushBusy ? "wait" : "pointer", opacity: pushBusy ? 0.7 : 1 }}>{pushBusy ? "Enabling…" : "Enable"}</button>
            </div>
          </div>
          <button onClick={() => dismiss(false)} aria-label="Close notification prompt" style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, flexShrink: 0 }}><X size={16} /></button>
        </div>
      </div>
    );
  }

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    advance("install");
  };
  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallReady(false);
    if (outcome === "accepted") {
      localStorage.setItem(INSTALL_ACCEPTED_KEY, "1");
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
    } else {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    }
    advance("install");
  };

  return (
    <div role="dialog" aria-label="Install Treffin" style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 420, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 16, padding: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <img src={`${import.meta.env.BASE_URL}pwa-icon-192.png`} alt="" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>Add Treffin to your home screen</p>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>
          {installPlatform === "ios"
            ? <><Share size={11} style={{ display: "inline", verticalAlign: "middle" }} /> Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</>
            : "Install for faster access, offline support, and a native app feel."}
        </p>
        {installPlatform === "android" && (
          <button onClick={install} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Download size={14} /> Install App
          </button>
        )}
      </div>
      <button onClick={dismissInstall} aria-label="Dismiss install prompt" style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, flexShrink: 0 }}><X size={18} /></button>
    </div>
  );
}