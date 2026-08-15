import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { authClient } from "@/lib/auth-client";
import { AuthShell, InputField, PrimaryButton, inputFocusHandlers, inputStyle } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setError(result.error.message ?? "Unable to request a reset link. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("The authentication service could not be reached. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="mb-1 text-[1.65rem] font-bold text-foreground">Reset your password</h1>
      <p className="mb-8 text-sm text-muted-foreground">We will email you a secure link if the account exists.</p>
      {sent ? (
        <div className="space-y-5" aria-live="polite">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">Check your inbox. For privacy, the same confirmation is shown for every email address.</div>
          <Link href="/sign-in" className="block text-center text-sm font-semibold text-indigo-400 hover:text-indigo-300">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <InputField label="Email" htmlFor="forgot-password-email">
            <input id="forgot-password-email" required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all" style={inputStyle} {...inputFocusHandlers} />
          </InputField>
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400" role="alert">{error}</div>}
          <PrimaryButton loading={pending} disabled={pending} label="Send reset link" loadingLabel="Sending..." />
          <Link href="/sign-in" className="text-center text-sm font-semibold text-indigo-400 hover:text-indigo-300">Back to sign in</Link>
        </form>
      )}
    </AuthShell>
  );
}