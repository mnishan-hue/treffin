import { FormEvent, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Eye, EyeOff, MailCheck } from "lucide-react";
import { emailOtpAuthClient, rememberAuthToken, useSession } from "@/lib/auth-client";
import { safeAuthReturnPath } from "@/lib/auth-navigation";
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
  account_not_linked: "This Google account is not linked yet. Sign in with email and password first, then link Google from your profile.",
  OAuthCallbackError: "Google sign-in was cancelled or failed. Please try again.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}

function authErrorMessage(message: string | undefined, fallback: string): string {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("expired")) return "This code has expired. Request a new code and try again.";
  if (normalized.includes("too many") || normalized.includes("locked")) return "Too many incorrect attempts. Please wait 15 minutes before trying again.";
  if (normalized.includes("invalid") && normalized.includes("code")) return "That code is incorrect. Check the email and try again.";
  if (normalized.includes("password") || normalized.includes("credential") || normalized.includes("user not found")) return "Email or password is incorrect.";
  if (normalized.includes("fetch") || normalized.includes("network")) return "The authentication service could not be reached. Check your connection and try again.";
  return message || fallback;
}

export default function SignInPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const oauthError = searchParams.get("error");
  const returnTo = safeAuthReturnPath(searchParams.get("next"));
  const { isSignedIn, isLoaded } = useSession();

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
    if (isLoaded && isSignedIn) window.location.replace(returnTo);
  }, [isLoaded, isSignedIn, returnTo]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function requestOtp(): Promise<boolean> {
    try {
      const result = await emailOtpAuthClient.twoFactor.sendOtp();
      if (result.error) {
        setError(authErrorMessage(result.error.message, "We could not send your sign-in code."));
        return false;
      }
      setNotice(`A six-digit code was sent to ${maskEmail(email)}.`);
      setResendSeconds(30);
      return true;
    } catch {
      setError("The authentication service could not be reached. Check your connection and try again.");
      return false;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || googlePending) return;
    setError("");
    setNotice("");
    setPending(true);
    try {
      const result = await emailOtpAuthClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (result.error) {
        setError(authErrorMessage(result.error.message, "Unable to sign in."));
        return;
      }
      const data = result.data as { twoFactorRedirect?: boolean; token?: string } | null;
      if (data?.twoFactorRedirect) {
        const sent = await requestOtp();
        if (sent) {
          setPassword("");
          setOtp("");
          setStep("otp");
        }
        return;
      }
      rememberAuthToken(data?.token);
      window.location.assign(returnTo);
    } catch {
      setError("The authentication service could not be reached. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function submitOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the complete six-digit code.");
      return;
    }
    setPending(true);
    try {
      const result = await emailOtpAuthClient.twoFactor.verifyOtp({ code: otp, trustDevice: false });
      if (result.error) {
        setError(authErrorMessage(result.error.message, "Unable to verify the code. Please try again."));
        return;
      }
      rememberAuthToken((result.data as { token?: string } | null)?.token);
      window.location.assign(returnTo);
    } catch {
      setError("The authentication service could not be reached. Check your connection and try again.");
    } finally {
      setPending(false);
    }
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
    if (pending || googlePending) return;
    setGooglePending(true);
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
    const callbackUrl = new URL("/sign-in", window.location.origin);
    callbackUrl.searchParams.set("next", returnTo);
    window.location.href = `${apiBase}/api/auth/signin/social?provider=google&callbackURL=${encodeURIComponent(callbackUrl.toString())}`;
  }

  const busy = pending || googlePending;

  if (step === "otp") {
    return (
      <AuthShell>
        <button type="button" onClick={returnToCredentials} disabled={pending} className="mb-6 flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300"><MailCheck className="h-6 w-6" /></div>
        <h1 className="mb-2 text-[1.65rem] font-bold text-foreground">Check your email</h1>
        <p className="mb-7 text-sm leading-6 text-muted-foreground">Enter the six-digit security code sent to <span className="break-all font-semibold text-foreground">{maskEmail(email)}</span>.</p>
        <form onSubmit={submitOtp} className="flex flex-col gap-4">
          <InputField label="One-time code" htmlFor="sign-in-otp">
            <input id="sign-in-otp" required autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="w-full rounded-xl px-3 py-3 pl-[0.25em] text-center font-mono text-2xl font-bold tracking-[0.25em] text-foreground outline-none transition-all placeholder:text-muted-foreground/30 sm:text-3xl sm:tracking-[0.35em]" style={inputStyle} {...inputFocusHandlers} />
          </InputField>
          {notice && <div role="status" className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.07] px-3 py-2.5 text-xs leading-5 text-emerald-300">{notice}</div>}
          {error && <div role="alert" className="rounded-lg border border-red-500/15 bg-red-500/[0.07] px-3 py-2.5 text-xs leading-5 text-red-400">{error}</div>}
          <PrimaryButton loading={pending} disabled={pending} label="Verify and sign in" loadingLabel="Verifying..." />
          <button type="button" onClick={resendOtp} disabled={pending || resendSeconds > 0} className="min-h-10 text-sm font-semibold text-indigo-400 transition-colors hover:text-indigo-300 disabled:cursor-not-allowed disabled:text-muted-foreground">
            {resendSeconds > 0 ? `Send a new code in ${resendSeconds}s` : "Send a new code"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">The code expires after five minutes and can be used only once.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="mb-1 text-[1.65rem] font-bold text-foreground" style={{ letterSpacing: "-0.02em" }}>Welcome back</h1>
      <p className="mb-8 text-sm text-muted-foreground">Sign in to your Treffin account</p>
      <div className="flex flex-col gap-4">
        {oauthError && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-400"><span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-red-400" />{OAUTH_ERROR_MESSAGES[oauthError] ?? "Google sign-in failed. Please try again or use email and password."}</div>}
        <GoogleButton onClick={signInWithGoogle} disabled={busy} loading={googlePending} />
        <Divider />
        <form onSubmit={submit} className="flex flex-col gap-4">
          <InputField label="Email" htmlFor="sign-in-email">
            <input id="sign-in-email" required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all" style={inputStyle} {...inputFocusHandlers} />
          </InputField>
          <InputField label="Password" htmlFor="sign-in-password" action={<Link href="/forgot-password" className="text-[0.7rem] font-semibold text-indigo-400 transition-colors hover:text-indigo-300">Forgot password?</Link>}>
            <div className="relative">
              <input id="sign-in-password" required type={showPassword ? "text" : "password"} autoComplete="current-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all" style={inputStyle} {...inputFocusHandlers} />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </InputField>
          {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-500/15 bg-red-500/[0.07] px-3 py-2.5 text-xs text-red-400"><span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}</div>}
          <PrimaryButton loading={pending} disabled={busy} label="Sign in" loadingLabel="Signing in..." />
        </form>
        <p className="text-center text-sm text-muted-foreground">Do not have an account? <Link href="/sign-up" className="font-semibold text-indigo-400 transition-colors hover:text-indigo-300">Sign up</Link></p>
      </div>
    </AuthShell>
  );
}