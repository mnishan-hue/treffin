import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Cookie, X, Download, Share, Bell } from "lucide-react";

const COOKIE_KEY = "treffin_cookie_consent";
const INSTALL_KEY = "treffin_pwa_dismissed";
const PUSH_KEY = "treffin_push_prompted";

const AUTH_ROUTES = ["/", "/sign-in", "/sign-up", "/onboarding"];
const INSTALL_MIN_MS = 30_000;
const BETWEEN_MS = 1_500;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type BannerType = "cookie" | "push" | "install";

function isBannerNeeded(type: BannerType): boolean {
  if (type === "cookie") return !localStorage.getItem(COOKIE_KEY);
  if (type === "push") {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
    if (Notification.permission !== "default") return false;
    return !localStorage.getItem(PUSH_KEY);
  }
  if (type === "install") {
    if (localStorage.getItem(INSTALL_KEY)) return false;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    return !isStandalone;
  }
  return false;
}

const QUEUE: BannerType[] = ["cookie", "push", "install"];

export function BannerQueue() {
  const [location] = useLocation();
  const { isSignedIn, isLoaded } = useUser();

  const [current, setCurrent] = useState<BannerType | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installReady, setInstallReady] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<"android" | "ios" | null>(null);

  const appEntryTime = useRef<number | null>(null);

  const isLandingPage = AUTH_ROUTES.some((r) => location === r || location.startsWith("/sign-"));
  const shouldShow = isLoaded && isSignedIn && !isLandingPage;

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);

    if (isIos && !isStandalone) {
      setInstallPlatform("ios");
      setInstallReady(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallPlatform("android");
      setInstallReady(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const advance = useCallback((from: BannerType) => {
    const idx = QUEUE.indexOf(from);
    const remaining = QUEUE.slice(idx + 1);
    const next = remaining.find(isBannerNeeded) ?? null;

    if (!next) { setCurrent(null); return; }

    if (next === "install") {
      const elapsed = appEntryTime.current ? Date.now() - appEntryTime.current : 0;
      const wait = Math.max(BETWEEN_MS, INSTALL_MIN_MS - elapsed);
      setTimeout(() => setCurrent("install"), wait);
    } else {
      setTimeout(() => setCurrent(next), BETWEEN_MS);
    }
  }, []);

  useEffect(() => {
    if (!shouldShow) { setCurrent(null); return; }

    appEntryTime.current = Date.now();
    // cookie is first in queue — included here so it only shows post-login
    const first = QUEUE.find(isBannerNeeded) ?? null;
    const timer = setTimeout(() => setCurrent(first), 1_500);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  if (!shouldShow || !current) return null;

  if (current === "cookie") {
    const done = (choice: "accepted" | "declined") => {
      localStorage.setItem(COOKIE_KEY, choice);
      advance("cookie");
    };
    return (
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "hsl(var(--card))", borderTop: "1px solid hsl(var(--border))", padding: "14px 20px", zIndex: 9999, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: "0 -4px 24px rgba(0,0,0,0.18)" }}>
        <Cookie size={20} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
        <p style={{ flex: 1, margin: 0, fontSize: 13, color: "hsl(var(--muted-foreground))", minWidth: 200 }}>
          We use cookies for authentication and improving your experience.{" "}
          <a href="/privacy" style={{ color: "hsl(var(--primary))", textDecoration: "none" }}>Privacy Policy</a>
        </p>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => done("declined")} style={{ background: "none", border: "1px solid hsl(var(--border))", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "hsl(var(--muted-foreground))", cursor: "pointer" }}>Decline</button>
          <button onClick={() => done("accepted")} style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Accept</button>
        </div>
        <button onClick={() => done("declined")} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, flexShrink: 0 }} aria-label="Close"><X size={16} /></button>
      </div>
    );
  }

  if (current === "push") {
    const done = (permanent = false) => {
      if (permanent) localStorage.setItem(PUSH_KEY, "dismissed");
      advance("push");
    };
    const enable = async () => {
      localStorage.setItem(PUSH_KEY, "asked");
      advance("push");
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification("Treffin notifications enabled!", {
          body: "You'll be notified about debate replies, rep changes, and trending topics.",
          icon: "/favicon.png",
        });
      }
    };
    return (
      <div style={{ position: "fixed", bottom: "80px", right: "16px", width: "min(320px, calc(100vw - 32px))", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "16px", padding: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 9999 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "hsl(var(--primary)/0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Bell size={20} style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>Stay in the loop</p>
            <p style={{ margin: "4px 0 12px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>
              Get notified about debate replies, new rep, and trending topics.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => done(true)} style={{ flex: 1, background: "none", border: "1px solid hsl(var(--border))", borderRadius: 8, padding: "7px 0", fontSize: 13, color: "hsl(var(--muted-foreground))", cursor: "pointer" }}>Not now</button>
              <button onClick={enable} style={{ flex: 1, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "7px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Enable</button>
            </div>
          </div>
          <button onClick={() => done(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, flexShrink: 0 }} aria-label="Close"><X size={16} /></button>
        </div>
      </div>
    );
  }

  if (current === "install") {
    if (!installReady) {
      advance("install");
      return null;
    }
    const done = () => {
      localStorage.setItem(INSTALL_KEY, "1");
      advance("install");
    };
    const install = async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") localStorage.setItem(INSTALL_KEY, "1");
      advance("install");
    };
    return (
      <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: "420px", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "16px", padding: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <img src="/treffin-mark.png" alt="Treffin" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>Add Treffin to your home screen</p>
          <p style={{ margin: "4px 0 10px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>
            {installPlatform === "ios"
              ? <><Share size={11} style={{ display: "inline", verticalAlign: "middle" }} /> Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> for the full app feel.</>
              : "Install for faster access, offline support, and a native app feel."}
          </p>
          {installPlatform === "android" && (
            <button onClick={install} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Download size={14} /> Install App
            </button>
          )}
        </div>
        <button onClick={done} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, flexShrink: 0 }} aria-label="Dismiss"><X size={18} /></button>
      </div>
    );
  }

  return null;
}
