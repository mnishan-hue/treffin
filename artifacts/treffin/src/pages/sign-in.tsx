import { FormEvent, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
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

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  account_not_linked:
    "This Google account isn't linked yet. Sign in with your email and password first, then link Google from your profile.",
  OAuthCallbackError:
    "Google sign-in was cancelled or failed. Please try again.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
};

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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result = await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Unable to sign in.");
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

  const busy = pending || googlePending;

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

          <InputField
            label="Password"
            action={
              <button
                type="button"
                tabIndex={-1}
                className="text-[0.7rem] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </button>
            }
          >
            <div className="relative">
              <input
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
