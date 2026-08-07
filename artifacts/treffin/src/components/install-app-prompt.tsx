/**
 * InstallAppPrompt — floating card that appears after a short delay.
 *
 * Android: clicking "Install" immediately fires the native browser dialog.
 * iOS:     instructions shown right away (no extra "Download" step before them).
 * Other:   banner hidden — nothing to offer.
 *
 * Once the user installs or permanently dismisses, the prompt never appears
 * again (tracked in localStorage).
 */
import { useState, useEffect } from "react";
import { Download, Share, X } from "lucide-react";
import { useInstallPWA } from "@/lib/use-install-pwa";

const DISMISSED_KEY = "treffin_install_prompted";
/** Wait 45 s after page load before showing — don't interrupt first impression */
const DELAY_MS = 45_000;

export function InstallAppPrompt() {
  const { isInstalled, platform, canAutoInstall, install } = useInstallPWA();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstalled) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    // Only show if there's something actionable to offer
    if (platform === "unsupported") return;

    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [isInstalled, platform]);

  // For Android: wait until the native event has fired before showing
  useEffect(() => {
    if (platform === "android" && visible && !canAutoInstall) {
      setVisible(false); // not ready yet — will re-show once canAutoInstall flips
    }
    if (platform === "android" && canAutoInstall && !localStorage.getItem(DISMISSED_KEY)) {
      setVisible(true);
    }
  }, [platform, canAutoInstall, visible]);

  const dismiss = (permanent = false) => {
    if (permanent) localStorage.setItem(DISMISSED_KEY, "dismissed");
    setVisible(false);
  };

  const handleInstall = async () => {
    localStorage.setItem(DISMISSED_KEY, "asked");
    const accepted = await install(); // fires native dialog on Android; no-op on iOS
    if (accepted) setVisible(false);
    // iOS: install() returns false → banner stays open showing Share instructions
  };

  if (!visible) return null;

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
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        zIndex: 9997,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <img
          src={`${import.meta.env.BASE_URL}treffin-mark.png`}
          alt="Treffin"
          style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>
            Download Treffin
          </p>

          {platform === "ios" ? (
            /* iOS: show steps immediately — no extra click needed */
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
              Tap your browser's{" "}
              <Share size={11} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
              <strong>Share</strong> button, then tap{" "}
              <strong>"Add to Home Screen"</strong> to install Treffin.
            </p>
          ) : (
            /* Android: one-tap install */
            <>
              <p style={{ margin: "4px 0 12px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>
                Install for faster access, offline support, and a native app feel.
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
