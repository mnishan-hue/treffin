import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * Listens for the SW_UPDATED message posted by the service worker when a new
 * version has been installed and claimed. Shows a slim top banner so the user
 * can reload to get the latest Treffin build without having to close/reopen.
 */
export function UpdatePrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") setVisible(true);
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "hsl(var(--primary))",
        color: "hsl(var(--primary-foreground))",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}
    >
      <RefreshCw size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, textAlign: "center" }}>
        A new version of Treffin is ready.
      </span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: 6,
          color: "inherit",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          padding: "4px 12px",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Update now
      </button>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss update banner"
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
          opacity: 0.75,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
