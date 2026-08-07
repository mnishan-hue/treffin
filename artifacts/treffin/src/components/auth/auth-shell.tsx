import { Zap, Trophy, Globe } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Real debates, real stakes",
    desc: "Structured arguments where your reputation is on the line.",
  },
  {
    icon: Trophy,
    title: "Ideas that earn respect",
    desc: "Reputation grows with every quality contribution you make.",
  },
  {
    icon: Globe,
    title: "Communities of thinkers",
    desc: "Find your intellectual tribe across hundreds of topics.",
  },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-[100dvh] overflow-hidden"
      style={{ background: "#04060f" }}
    >
      {/* ── Ambient background ─────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Indigo orb — top-left */}
        <div
          style={{
            position: "absolute",
            top: "-18%",
            left: "-8%",
            width: "660px",
            height: "660px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(79,106,247,0.14) 0%, transparent 70%)",
          }}
        />
        {/* Violet orb — bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: "-22%",
            right: "-10%",
            width: "580px",
            height: "580px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)",
          }}
        />
        {/* Subtle dot grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Left brand panel (desktop only) ───────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[44%] flex-col justify-between p-14 border-r border-white/[0.055]">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}treffin-mark.png`}
            alt="Treffin"
            className="h-9 w-auto object-contain"
            style={{
              filter: "drop-shadow(0 0 14px rgba(139,92,246,0.75))",
            }}
          />
          <span className="text-lg font-bold tracking-tight text-white">
            Treffin
          </span>
        </div>

        {/* Hero copy */}
        <div>
          <h2
            className="text-[2.55rem] font-bold leading-[1.15] text-white mb-4"
            style={{ letterSpacing: "-0.02em" }}
          >
            The arena for
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #60A5FA 0%, #818CF8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              great minds.
            </span>
          </h2>
          <p className="text-[#8b98b8] text-[0.88rem] leading-relaxed mb-11 max-w-[320px]">
            Thousands of thinkers debate ideas, earn reputation, and build
            intellectual communities every day on Treffin.
          </p>

          {/* Feature list */}
          <div className="flex flex-col gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: "rgba(79,106,247,0.11)",
                    border: "1px solid rgba(79,106,247,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon style={{ width: 15, height: 15, color: "#818CF8" }} />
                </div>
                <div>
                  <p className="text-white text-[0.82rem] font-semibold">
                    {title}
                  </p>
                  <p className="text-[#8b98b8] text-[0.75rem] mt-0.5 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[#8b98b8]/25 text-xs">
          © 2026 Treffin. All rights reserved.
        </p>
      </div>

      {/* ── Right form area ────────────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-14">
        <div className="w-full max-w-[390px]">
          {/* Mobile-only logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <img
              src={`${import.meta.env.BASE_URL}treffin-mark.png`}
              alt="Treffin"
              className="h-14 w-auto object-contain mb-2"
              style={{
                filter: "drop-shadow(0 0 20px rgba(139,92,246,0.8))",
              }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b98b8]/50">
              Where Minds Celebrate.
            </span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Shared primitives used by sign-in + sign-up ─────────────────────────── */

export function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function InputField({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[0.7rem] font-bold uppercase tracking-widest text-[#8b98b8]/65">
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.085)",
};

export const inputFocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(79,106,247,0.65)";
    e.currentTarget.style.background = "rgba(255,255,255,0.075)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79,106,247,0.12)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.085)";
    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
    e.currentTarget.style.boxShadow = "none";
  },
};

export function GoogleButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 rounded-xl py-3 font-medium text-white text-sm transition-all disabled:opacity-50"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.11)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.09)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(255,255,255,0.06)";
      }}
    >
      {loading ? (
        <>
          <Spinner />
          <span>Redirecting to Google…</span>
        </>
      ) : (
        <>
          <GoogleIcon />
          <span>Continue with Google</span>
        </>
      )}
    </button>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-px flex-1"
        style={{ background: "rgba(255,255,255,0.07)" }}
      />
      <span className="text-xs font-semibold text-[#8b98b8]/45 uppercase tracking-widest">
        or
      </span>
      <div
        className="h-px flex-1"
        style={{ background: "rgba(255,255,255,0.07)" }}
      />
    </div>
  );
}

export function PrimaryButton({
  loading,
  disabled,
  label,
  loadingLabel,
}: {
  loading: boolean;
  disabled: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-1 w-full rounded-xl py-3 font-semibold text-white text-sm transition-all disabled:opacity-60"
      style={{
        background: "linear-gradient(135deg, #2563EB 0%, #4F6AF7 100%)",
        boxShadow: "0 4px 20px rgba(79,106,247,0.38)",
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 6px 28px rgba(79,106,247,0.58)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 4px 20px rgba(79,106,247,0.38)";
      }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
