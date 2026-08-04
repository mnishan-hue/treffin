import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    localStorage.setItem("treffin_name", name.trim());
    const result = await authClient.signUp.email({ name: name.trim(), email, password });
    setPending(false);
    if (result.error) { localStorage.removeItem("treffin_name"); setError(result.error.message ?? "Unable to create your account."); return; }
    setLocation("/");
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at top, #0d1830 0%, #060810 60%)" }}>
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}treffin-mark.png`} alt="Treffin" className="h-14 w-auto object-contain drop-shadow-[0_0_20px_rgba(139,92,246,0.8)]" />
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">Where Minds Celebrate.</span>
        </div>
        <div className="rounded-2xl border border-[#1e2d45] bg-[#0d1117] p-6 shadow-2xl shadow-black/50">
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-[#8b98b8]">Join Treffin — where minds debate</p>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#8b98b8]">Name
              <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-[#1e2d45] bg-[#161d2b] px-3 py-2.5 text-white outline-none focus:border-blue-500" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#8b98b8]">Email
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-[#1e2d45] bg-[#161d2b] px-3 py-2.5 text-white outline-none focus:border-blue-500" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#8b98b8]">Password
              <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-[#1e2d45] bg-[#161d2b] px-3 py-2.5 text-white outline-none focus:border-blue-500" />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button disabled={pending} className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Creating account…" : "Create account"}</button>
            <p className="text-center text-sm text-[#8b98b8]">Already have an account? <Link href="/sign-in" className="font-medium text-blue-400 hover:text-blue-300">Sign in</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
}