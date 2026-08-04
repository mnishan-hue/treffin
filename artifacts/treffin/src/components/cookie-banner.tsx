import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "treffin_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "hsl(var(--card))",
        borderTop: "1px solid hsl(var(--border))",
        padding: "14px 20px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
      }}
    >
      <Cookie size={20} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
      <p style={{ flex: 1, margin: 0, fontSize: 13, color: "hsl(var(--muted-foreground))", minWidth: 200 }}>
        We use cookies for authentication and improving your experience.{" "}
        <a href="/privacy" style={{ color: "hsl(var(--primary))", textDecoration: "none" }}>
          Privacy Policy
        </a>
      </p>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            background: "none",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            color: "hsl(var(--muted-foreground))",
            cursor: "pointer",
          }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            border: "none",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Accept
        </button>
      </div>
      <button
        onClick={decline}
        style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, flexShrink: 0 }}
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}
