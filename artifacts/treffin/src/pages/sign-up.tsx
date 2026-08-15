import { FormEvent, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { authClient, rememberAuthToken, useSession } from "@/lib/auth-client";
import { safeAuthReturnPath } from "@/lib/auth-navigation";
import { AuthShell, GoogleButton, Divider, PrimaryButton, InputField, inputStyle, inputFocusHandlers } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  const search = useSearch();
  const returnTo = safeAuthReturnPath(new URLSearchParams(search).get("next"));
  const { isSignedIn, isLoaded } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) window.location.replace(returnTo);
  }, [isLoaded, isSignedIn, returnTo]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || googlePending) return;
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2) {
      setError("Enter your full name.");
      return;
    }
    setError("");
    setPending(true);
    localStorage.setItem("treffin_name", cleanName);
    try {
      const result = await authClient.signUp.email({
        name: cleanName,
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.error) {
        localStorage.removeItem("treffin_name");
        setError(result.error.message ?? "Unable to create your account.");
        return;
      }
      rememberAuthToken((result.data as { token?: string } | null)?.token);
      window.location.assign(returnTo);
    } catch {
      localStorage.removeItem("treffin_name");
      setError("The authentication service could not be reached. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function signInWithGoogle() {
    if (pending || googlePending) return;
    setGooglePending(true);
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
    const callbackUrl = new URL("/sign-in", window.location.origin);
    callbackUrl.searchParams.set("next", returnTo);
    window.location.href = `${apiBase}/api/auth/signin/social?provider=google&callbackURL=${encodeURIComponent(callbackUrl.toString())}`;
  }

  const strength = (() => {
    if (password.length === 0) return 0;
    if (password.length < 6) return 1;
    if (password.length < 8) return 2;
    const extras = [/[A-Z]/.test(password), /[0-9]/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length;
    return 2 + extras;
  })();
  const strengthLabel = ["", "Too short", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"][strength];
  const busy = pending || googlePending;

  return (
    <AuthShell>
      <h1 className="mb-1 text-[1.65rem] font-bold text-foreground" style={{ letterSpacing: "-0.02em" }}>Create your account</h1>
      <p className="mb-8 text-sm text-muted-foreground">Join the arena of ideas on Treffin</p>
      <div className="flex flex-col gap-4">
        <GoogleButton onClick={signInWithGoogle} disabled={busy} loading={googlePending} />
        <Divider />
        <form onSubmit={submit} className="flex flex-col gap-4">
          <InputField label="Full name" htmlFor="sign-up-name">
            <input id="sign-up-name" required type="text" autoComplete="name" minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" className="w-full rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all" style={inputStyle} {...inputFocusHandlers} />
          </InputField>
          <InputField label="Email" htmlFor="sign-up-email">
            <input id="sign-up-email" required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all" style={inputStyle} {...inputFocusHandlers} />
          </InputField>
          <InputField label="Password" htmlFor="sign-up-password">
            <div className="relative">
              <input id="sign-up-password" required minLength={8} maxLength={128} type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all" style={inputStyle} {...inputFocusHandlers} />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            {password.length > 0 && <div className="mt-2 flex flex-col gap-1.5" aria-live="polite"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((level) => <div key={level} className="h-1 flex-1 rounded-full transition-all duration-300" style={{ background: level <= strength ? strengthColor : "hsl(var(--muted))" }} />)}</div><p className="text-xs transition-colors" style={{ color: strengthColor }}>{strengthLabel}</p></div>}
          </InputField>
          {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-500/15 bg-red-500/[0.07] px-3 py-2.5 text-xs text-red-400"><span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}</div>}
          <PrimaryButton loading={pending} disabled={busy} label="Create account" loadingLabel="Creating account..." />
          <p className="px-2 text-center text-[0.68rem] leading-relaxed text-muted-foreground/70">By creating an account you agree to Treffin&apos;s <Link href="/terms" className="text-indigo-400 transition-colors hover:text-indigo-300">Terms of Service</Link> and <Link href="/privacy" className="text-indigo-400 transition-colors hover:text-indigo-300">Privacy Policy</Link>.</p>
        </form>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href={`/sign-in?next=${encodeURIComponent(returnTo)}`} className="font-semibold text-indigo-400 transition-colors hover:text-indigo-300">Sign in</Link></p>
      </div>
    </AuthShell>
  );
}