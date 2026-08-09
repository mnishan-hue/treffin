import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  AuthShell,
  GoogleButton,
  Divider,
  PrimaryButton,
  InputField,
  inputStyle,
  inputFocusHandlers,
} from "@/components/auth/auth-shell";

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    localStorage.setItem("treffin_name", name.trim());
    const result = await authClient.signUp.email({
      name: name.trim(),
      email,
      password,
    });
    setPending(false);
    if (result.error) {
      localStorage.removeItem("treffin_name");
      setError(result.error.message ?? "Unable to create your account.");
      return;
    }
    setLocation("/");
  }

  function signInWithGoogle() {
    setGooglePending(true);
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
      /\/+$/,
      "",
    );
    window.location.href = `${apiBase}/api/auth/signin/social?provider=google&callbackURL=${encodeURIComponent(window.location.origin)}`;
  }

  // Password strength indicator
  const strength = (() => {
    if (password.length === 0) return 0;
    if (password.length < 6) return 1;
    if (password.length < 8) return 2;
    const hasUpper = /[A-Z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    const extras = [hasUpper, hasNum, hasSpecial].filter(Boolean).length;
    return 2 + extras;
  })();

  const strengthLabel = ["", "Too short", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = [
    "",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#10b981",
  ][strength];

  const busy = pending || googlePending;

  return (
    <AuthShell>
      {/* Heading */}
      <h1
        className="text-[1.65rem] font-bold text-foreground mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        Create your account
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Join the arena of ideas on Treffin
      </p>

      <div className="flex flex-col gap-4">
        {/* Google */}
        <GoogleButton
          onClick={signInWithGoogle}
          disabled={busy}
          loading={googlePending}
        />

        <Divider />

        {/* Form */}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <InputField label="Full name">
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="w-full rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all"
              style={inputStyle}
              {...inputFocusHandlers}
            />
          </InputField>

          <InputField label="Email">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all"
              style={inputStyle}
              {...inputFocusHandlers}
            />
          </InputField>

          <InputField label="Password">
            <div className="relative">
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all"
                style={inputStyle}
                {...inputFocusHandlers}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        background:
                          level <= strength ? strengthColor : "rgba(255,255,255,0.08)",
                      }}
                    />
                  ))}
                </div>
                <p
                  className="text-xs transition-colors"
                  style={{ color: strengthColor }}
                >
                  {strengthLabel}
                </p>
              </div>
            )}
          </InputField>

          {error && (
            <div
              className="rounded-lg px-3 py-2.5 text-xs text-red-400 flex items-center gap-2"
              style={{
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          <PrimaryButton
            loading={pending}
            disabled={busy}
            label="Create account"
            loadingLabel="Creating account…"
          />

          <p className="text-center text-[0.68rem] text-muted-foreground/60 leading-relaxed px-2">
            By creating an account you agree to Treffin's{" "}
            <span className="text-indigo-400/70 hover:text-indigo-400 cursor-pointer transition-colors">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="text-indigo-400/70 hover:text-indigo-400 cursor-pointer transition-colors">
              Privacy Policy
            </span>
            .
          </p>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
