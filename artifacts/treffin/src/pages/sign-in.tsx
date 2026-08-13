import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, Eye, EyeOff, MailCheck } from "lucide-react";
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

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  account_not_linked:
    "This Google account isn't linked yet. Sign in with your email and password first, then link Google from your profile.",
  OAuthCallbackError:
    "Google sign-in was cancelled or failed. Please try again.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}

function otpErrorMessage(message?: string): string {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("expired")) return "This code has expired. Request a new code and try again.";
  if (normalized.includes("too many") || normalized.includes("locked")) return "Too many incorrect attempts. Please wait 15 minutes before trying again.";
  if (normalized.includes("invalid")) return "That code is incorrect. Check the email and try again.";
  return message || "Unable to verify the code. Please try again.";
}

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const oauthError = new URLSearchParams(search).get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);


  async function requestOtp(): Promise<boolean> {
    const result = await authClient.twoFactor.sendOtp();
    if (result.error) {
      setError(result.error.message ?? "We could not send your sign-in code.");
      return false;
    }
    setNotice(`A six-digit code was sent to ${maskEmail(email)}.`);
    setResendSeconds(30);
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPending(true);
    const result = await authClient.signIn.email({ email: email.trim(), password });
    if (result.error) {
      setPending(false);
      setError(result.error.message ?? "Unable to sign in.");
      return;
    }

    const data = result.data as { twoFactorRedirect?: boolean } | null;
    if (data?.twoFactorRedirect) {
      const sent = await requestOtp();
      setPending(false);
      if (sent) {
        setPassword("");
        setOtp("");
        setStep("otp");
      }
      return;
    }

    setPending(false);
    setLocation("/");
  }

  async function submitOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the complete six-digit code.");
      return;
    }
    setPending(true);
    const result = await authClient.twoFactor.verifyOtp({ code: otp, trustDevice: false });
    setPending(false);
    if (result.error) {
      setError(otpErrorMessage(result.error.message));
      return;
    }
    setLocation("/");
  }

  async function resendOtp() {
    if (resendSeconds > 0 || pending) return;
    setError("");
    setNotice("");
    setPending(true);
    await requestOtp();
    setPending(false);
  }

  function returnToCredentials() {
    setStep("credentials");
    setOtp("");
    setError("");
    setNotice("");
  }

  function signInWithGoogle() {
    setGooglePending(true);
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
      /\/+$/,
      "",
    );
    window.location.href = `${apiBase}/api/auth/signin/social?provider=google&callbackURL=${encodeURIComponent(window.location.origin)}`;
  }

  const busy = pending || googlePending;

  if (step === "otp") {
    return (
      <AuthShell>
        <button
          type="button"
          onClick={returnToCredentials}
          className="mb-6 flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-[1.65rem] font-bold text-foreground">Check your email</h1>
        <p className="mb-7 text-sm leading-6 text-muted-foreground">
          Enter the six-digit security code sent to{" "}
          <span className="break-all font-semibold text-foreground">{maskEmail(email)}</span>.
        </p>

        <form onSubmit={submitOtp} className="flex flex-col gap-4">
          <InputField label="One-time code" htmlFor="sign-in-otp">
            <input
              id="sign-in-otp"
              required
              autoFocus
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-xl px-3 py-3 pl-[0.25em] text-center font-mono text-2xl font-bold tracking-[0.25em] text-foreground outline-none transition-all placeholder:text-muted-foreground/30 sm:text-3xl sm:tracking-[0.35em]"
              style={inputStyle}
              {...inputFocusHandlers}
            />
          </InputField>

          {notice && (
            <div role="status" className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.07] px-3 py-2.5 text-xs leading-5 text-emerald-300">
              {notice}
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-lg border border-red-500/15 bg-red-500/[0.07] px-3 py-2.5 text-xs leading-5 text-red-400">
              {error}
            </div>
          )}

          <PrimaryButton loading={pending} disabled={pending} label="Verify and sign in" loadingLabel="Verifying..." />
          <button
            type="button"
            onClick={resendOtp}
            disabled={pending || resendSeconds > 0}
            className="min-h-10 text-sm font-semibold text-indigo-400 transition-colors hover:text-indigo-300 disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            {resendSeconds > 0 ? `Send a new code in ${resendSeconds}s` : "Send a new code"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
          The code expires after five minutes and can be used only once.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {/* Heading */}
      <h1
        className="text-[1.65rem] font-bold text-foreground mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        Welcome back
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Sign in to your Treffin account
      </p>

      <div className="flex flex-col gap-4">
        {/* OAuth error banner */}
        {oauthError && (
          <div
            className="rounded-xl px-4 py-3 text-sm text-red-400 flex items-start gap-2.5"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <svg
              className="w-4 h-4 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span>
              {OAUTH_ERROR_MESSAGES[oauthError] ??
                "Google sign-in failed. Please try again or use email and password."}
            </span>
          </div>
        )}

        {/* Google */}
        <GoogleButton
          onClick={signInWithGoogle}
          disabled={busy}
          loading={googlePending}
        />

        <Divider />

        {/* Email + password form */}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <InputField label="Email" htmlFor="sign-in-email">
            <input
              id="sign-in-email"
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

          <InputField
            label="Password"
            htmlFor="sign-in-password"
            action={
              <Link
                href="/forgot-password"
                className="text-[0.7rem] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </Link>
            }
          >
            <div className="relative">
              <input
                id="sign-in-password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            label="Sign in"
            loadingLabel="Signing in…"
          />
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
