import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

const PROMPT_KEY = "treffin_push_prompted";
const DELAY_MS = 30_000;

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PROMPT_KEY)) return;

    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = (permanent = false) => {
    if (permanent) localStorage.setItem(PROMPT_KEY, "dismissed");
    setVisible(false);
  };

  const enable = async () => {
    localStorage.setItem(PROMPT_KEY, "asked");
    setVisible(false);
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("Treffin notifications enabled!", {
        body: "You'll be notified about replies, debate updates, and rep changes.",
        icon: `${import.meta.env.BASE_URL}treffin-mark.png`,
      });
    }
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
          <Bell size={20} style={{ color: "hsl(var(--primary))" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>
            Stay in the loop
          </p>
          <p style={{ margin: "4px 0 12px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>
            Get notified about debate replies, new rep, and trending topics.
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
              onClick={enable}
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
              Enable
            </button>
          </div>
        </div>
        <button
          onClick={() => dismiss(false)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, flexShrink: 0 }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
