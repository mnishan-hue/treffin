import { useState, useEffect, useRef } from "react";
import { Download, X } from "lucide-react";

const PROMPT_KEY = "treffin_install_prompted";
const DELAY_MS = 3 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppPrompt() {
  const [visible, setVisible] = useState(false);
  const deferredEvent = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(PROMPT_KEY)) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredEvent.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const timer = setTimeout(() => setVisible(true), DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = (permanent = false) => {
    if (permanent) localStorage.setItem(PROMPT_KEY, "dismissed");
    setVisible(false);
  };

  const install = async () => {
    localStorage.setItem(PROMPT_KEY, "asked");
    const event = deferredEvent.current;
    if (event) {
      setVisible(false);
      await event.prompt();
      deferredEvent.current = null;
      return;
    }
    // No native install prompt available (e.g. iOS Safari) — keep the
    // banner up but swap in manual "Add to Home Screen" instructions.
    setManualInstructions(true);
  };

  const [manualInstructions, setManualInstructions] = useState(false);

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
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "hsl(var(--primary)/0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Download size={20} style={{ color: "hsl(var(--primary))" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>
            Download Treffin
          </p>
          <p style={{ margin: "4px 0 12px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>
            {manualInstructions
              ? "Tap your browser's Share button, then \"Add to Home Screen\" to install Treffin."
              : "Install Treffin on your device for a faster, full-screen experience."}
          </p>
          {!manualInstructions && (
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
                onClick={install}
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
                }}
              >
                Download
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => dismiss(true)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, flexShrink: 0 }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
