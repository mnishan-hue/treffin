/**
 * InstallAppPrompt — floating card that appears after a short delay.
 *
 * Android: clicking "Install" immediately fires the native browser dialog.
 * iOS:     instructions shown right away (no extra "Download" step before them).
 * Other:   banner hidden — nothing to offer.
 *
 * Entrance: smooth slide-up + fade-in via CSS transition (no jarring pop-in).
 * Exit:     smooth fade + slide-down before unmounting.
 *
 * Once the user installs or permanently dismisses, the prompt never appears
 * again (tracked in localStorage).
 */
import { useState, useEffect, useRef } from "react";
import { Download, Share, X } from "lucide-react";
import { useInstallPWA } from "@/lib/use-install-pwa";

const DISMISSED_KEY = "treffin_install_prompted";
/** Wait 45 s after page load before showing — don't interrupt first impression */
const DELAY_MS = 45_000;

export function InstallAppPrompt() {
  const { isInstalled, platform, canAutoInstall, install } = useInstallPWA();

  // `ready` = should the card be in the DOM at all
  const [ready, setReady] = useState(false);
  // `entered` = CSS transition target (false → hidden, true → fully visible)
  const [entered, setEntered] = useState(false);
  // `leaving` = triggered when dismissing so we animate out before unmounting
  const [leaving, setLeaving] = useState(false);

  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decide when to show
  useEffect(() => {
    if (isInstalled) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (platform === "unsupported") return;

    const timer = setTimeout(() => setReady(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [isInstalled, platform]);

  // For Android: don't show until the native event has actually fired
  useEffect(() => {
    if (platform !== "android") return;
    if (canAutoInstall && !localStorage.getItem(DISMISSED_KEY)) {
      setReady(true);
    }
  }, [platform, canAutoInstall]);

  // Two-frame entrance: mount → next frame → add transition class
  useEffect(() => {
    if (!ready) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  const dismiss = (permanent = false) => {
    if (permanent) localStorage.setItem(DISMISSED_KEY, "dismissed");
    // Animate out, then unmount
    setEntered(false);
    setLeaving(true);
    exitTimer.current = setTimeout(() => {
      setReady(false);
      setLeaving(false);
    }, 300);
  };

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  const handleInstall = async () => {
    localStorage.setItem(DISMISSED_KEY, "asked");
    const accepted = await install();
    if (accepted) dismiss(false);
  };

  if (!ready && !leaving) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        right: "16px",
        width: "min(320px, calc(100vw - 32px))",
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
        zIndex: 9997,
        // Smooth entrance / exit
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(18px)",
        transition: "opacity 300ms cubic-bezier(0.4,0,0.2,1), transform 300ms cubic-bezier(0.4,0,0.2,1)",
        willChange: "opacity, transform",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <img
          src={`${import.meta.env.BASE_URL}treffin-mark.png`}
          alt="Treffin"
          style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>
            Download Treffin
          </p>

          {platform === "ios" ? (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.55 }}>
              Tap your browser's{" "}
              <Share size={11} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
              <strong>Share</strong> button, then tap{" "}
              <strong>"Add to Home Screen"</strong>.
            </p>
          ) : (
            <>
              <p style={{ margin: "4px 0 12px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.45 }}>
                Faster access, offline support, and a native app feel.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => dismiss(true)}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    padding: "7px 0",
                    fontSize: 13,
                    color: "hsl(var(--muted-foreground))",
                    cursor: "pointer",
                  }}
                >
                  Not now
                </button>
                <button
                  onClick={handleInstall}
                  style={{
                    flex: 1,
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 0",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Download size={13} /> Install
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => dismiss(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "hsl(var(--muted-foreground))",
            padding: 0,
            flexShrink: 0,
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
