/**
 * useInstallPWA — shared hook for PWA install logic.
 *
 * Usage:
 *   const { isInstalled, platform, canAutoInstall, install } = useInstallPWA();
 *
 * - isInstalled:     already running as installed PWA → hide all install UI
 * - platform:        "android" | "ios" | "unsupported"
 * - canAutoInstall:  true when the native browser dialog is ready (Android only)
 * - install():       fires native prompt on Android; returns false on iOS/unsupported
 *                    (caller is responsible for showing manual instructions in that case)
 */
import { useState, useEffect, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "android" | "ios" | "unsupported";

export interface UseInstallPWAReturn {
  isInstalled: boolean;
  platform: InstallPlatform;
  canAutoInstall: boolean;
  install: () => Promise<boolean>;
}

export function useInstallPWA(): UseInstallPWAReturn {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canAutoInstall, setCanAutoInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("unsupported");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);
    if (standalone) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setPlatform("ios");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setPlatform("android");
      setCanAutoInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt.current) return false;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      deferredPrompt.current = null;
      setCanAutoInstall(false);
    }
    return outcome === "accepted";
  };

  return { isInstalled, platform, canAutoInstall, install };
}
