import { FormEvent, useState } from "react";
import { Link, useSearch } from "wouter";
import { authClient, rememberAuthToken } from "@/lib/auth-client";
import { AuthShell, InputField, PrimaryButton, inputFocusHandlers, inputStyle } from "@/components/auth/auth-shell";

export default function ResetPasswordPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const invalidToken = params.get("error") === "INVALID_TOKEN" || !token;
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || pending) return;
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message ?? "This reset link is invalid or has expired.");
        return;
      }
      rememberAuthToken(null);
      setPassword("");
      setConfirmation("");
      setComplete(true);
    } catch {
      setError("The authentication service could not be reached. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="mb-1 text-[1.65rem] font-bold text-foreground">Choose a new password</h1>
      <p className="mb-8 text-sm text-muted-foreground">Use between eight and 128 characters.</p>
      {invalidToken ? (
        <div className="space-y-5"><div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">This password reset link is invalid or has expired.</div><Link href="/forgot-password" className="block text-center text-sm font-semibold text-indigo-400 hover:text-indigo-300">Request a new link</Link></div>
      ) : complete ? (
        <div className="space-y-5" aria-live="polite"><div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">Your password was changed and existing sessions were signed out.</div><Link href="/sign-in" className="block text-center text-sm font-semibold text-indigo-400 hover:text-indigo-300">Sign in with your new password</Link></div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <InputField label="New password" htmlFor="reset-password"><input id="reset-password" required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-all" style={inputStyle} {...inputFocusHandlers} /></InputField>
          <InputField label="Confirm password" htmlFor="reset-password-confirmation"><input id="reset-password-confirmation" required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-all" style={inputStyle} {...inputFocusHandlers} /></InputField>
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400" role="alert">{error}</div>}
          <PrimaryButton loading={pending} disabled={pending} label="Change password" loadingLabel="Changing..." />
        </form>
      )}
    </AuthShell>
  );
}