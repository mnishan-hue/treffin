import { FormEvent, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { authClient } from "@/lib/auth-client";

function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at top, #0d1830 0%, #060810 60%)" }}>
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}treffin-mark.png`} alt="Treffin" className="h-14 w-auto object-contain drop-shadow-[0_0_20px_rgba(139,92,246,0.8)]" />
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">Where Minds Celebrate.</span>
        </div>
        <div className="rounded-2xl border border-[#1e2d45] bg-[#0d1117] p-6 shadow-2xl shadow-black/50">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-[#8b98b8]">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  account_not_linked: "This Google account isn't linked yet. Sign in with your email and password first, then link Google from your profile.",
  OAuthCallbackError: "Google sign-in was cancelled or failed. Please try again.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
};

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const oauthError = new URLSearchParams(search).get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result = await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) { setError(result.error.message ?? "Unable to sign in."); return; }
    setLocation("/");
  }

  async function signInWithGoogle() {
    setGooglePending(true);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.origin,
    });
    // page will redirect — no need to reset state
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Treffin account">
      <div className="mt-6 flex flex-col gap-4">
        {/* OAuth error banner */}
        {oauthError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {OAUTH_ERROR_MESSAGES[oauthError] ?? "Google sign-in failed. Please try again or use email and password."}
          </div>
        )}

        {/* Google */}
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={googlePending || pending}
          className="flex items-center justify-center gap-3 rounded-xl border border-[#1e2d45] bg-[#161d2b] py-2.5 font-medium text-white transition hover:bg-[#1e2d45] disabled:opacity-60"
        >
          {googlePending ? (
            <span className="text-sm">Redirecting…</span>
          ) : (
            <>
              {/* Google logo */}
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm">Continue with Google</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#1e2d45]" />
          <span className="text-xs text-[#8b98b8]">or</span>
          <div className="h-px flex-1 bg-[#1e2d45]" />
        </div>

        {/* Email / password */}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-[#8b98b8]">Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-[#1e2d45] bg-[#161d2b] px-3 py-2.5 text-white outline-none focus:border-blue-500" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-[#8b98b8]">Password
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-[#1e2d45] bg-[#161d2b] px-3 py-2.5 text-white outline-none focus:border-blue-500" />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={pending || googlePending} className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
        </form>

        <p className="text-center text-sm text-[#8b98b8]">Don't have an account? <Link href="/sign-up" className="font-medium text-blue-400 hover:text-blue-300">Sign up</Link></p>
      </div>
    </AuthShell>
  );
}
