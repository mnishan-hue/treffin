import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface ThresholdData {
  threshold: number;
}

interface UpdateResult {
  ok: boolean;
  threshold: number;
  notified: number;
}

const TIERS = (elite: number) => [
  { name: "Novice",        range: `0 – ${Math.floor(elite * 0.1) - 1}`,     color: "text-slate-400",  dot: "bg-slate-400" },
  { name: "Thinker",       range: `${Math.floor(elite * 0.1)} – ${Math.floor(elite * 0.3) - 1}`,   color: "text-blue-400",   dot: "bg-blue-400" },
  { name: "Scholar",       range: `${Math.floor(elite * 0.3)} – ${Math.floor(elite * 0.6) - 1}`,   color: "text-indigo-400", dot: "bg-indigo-400" },
  { name: "Intellectual",  range: `${Math.floor(elite * 0.6)} – ${elite - 1}`,                      color: "text-orange-400", dot: "bg-orange-400" },
  { name: "Elite Thinker", range: `${elite.toLocaleString()}+`,                                      color: "text-yellow-400", dot: "bg-yellow-400" },
];

export default function ReputationSettings() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [confirming, setConfirming] = useState(false);

  const { data, isLoading } = useQuery<ThresholdData>({
    queryKey: ["elite-threshold"],
    queryFn: () => api.get<ThresholdData>("/admin/settings/elite-threshold"),
  });

  const mutation = useMutation<UpdateResult, Error, number>({
    mutationFn: (threshold) =>
      api.put<UpdateResult>("/admin/settings/elite-threshold", { threshold }),
    onSuccess: (result) => {
      toast.success(
        `Threshold updated to ${result.threshold.toLocaleString()} rep — ${result.notified} user${result.notified !== 1 ? "s" : ""} notified.`
      );
      setInput("");
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ["elite-threshold"] });
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update threshold");
      setConfirming(false);
    },
  });

  const currentThreshold = data?.threshold ?? 1000;
  const parsedInput = parseInt(input.replace(/,/g, ""), 10);
  const isValid = !isNaN(parsedInput) && parsedInput >= 1 && parsedInput <= 1_000_000;
  const preview = isValid ? parsedInput : currentThreshold;
  const changed = isValid && parsedInput !== currentThreshold;

  const handleSubmit = () => {
    if (!isValid || !changed) return;
    if (!confirming) { setConfirming(true); return; }
    mutation.mutate(parsedInput);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Reputation Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control the reputation thresholds that determine user tiers. Changes take effect
          instantly and notify all users.
        </p>
      </div>

      {/* Current threshold card */}
      <div className="rounded-xl border border-yellow-500/25 bg-gradient-to-br from-yellow-950/40 via-amber-950/20 to-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15l-3 5H6l3-5H6l6-10 6 10h-3l3 5h-3l-3-5z" />
          </svg>
          <h2 className="text-sm font-semibold text-yellow-200">Elite Thinker Threshold</h2>
        </div>

        {isLoading ? (
          <div className="h-8 w-28 rounded-lg bg-muted/30 animate-pulse" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-yellow-400">
              {currentThreshold.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">rep required</span>
          </div>
        )}

        {/* Tier ladder preview */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {changed ? "Preview after change" : "Current tier ladder"}
          </p>
          <div className="grid grid-cols-1 gap-1">
            {TIERS(preview).reverse().map((t) => (
              <div key={t.name} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted/10 border border-border/30">
                <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`} />
                <span className={`text-xs font-semibold ${t.color} w-28 shrink-0`}>{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.range} rep</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Update form */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Change Threshold</h2>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">New Elite Thinker rep requirement</label>
          <input
            type="number"
            min={1}
            max={1_000_000}
            step={100}
            value={input}
            onChange={(e) => { setInput(e.target.value); setConfirming(false); }}
            placeholder={`Current: ${currentThreshold.toLocaleString()}`}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {input && !isValid && (
            <p className="text-xs text-destructive">Enter a number between 1 and 1,000,000.</p>
          )}
        </div>

        {/* Warning when confirming */}
        {confirming && changed && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5">
            <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-amber-300 leading-relaxed">
              This will update the threshold to <strong className="text-amber-200">{parsedInput.toLocaleString()} rep</strong> and
              send an in-app notification + push notification to <strong className="text-amber-200">all users</strong>.
              Click confirm to proceed.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!isValid || !changed || mutation.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              confirming
                ? "bg-amber-500 hover:bg-amber-400 text-black"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {mutation.isPending
              ? "Updating…"
              : confirming
              ? "Confirm & Notify All Users"
              : "Update Threshold"}
          </button>
          {confirming && (
            <button
              onClick={() => setConfirming(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-1.5">
        <p className="text-xs font-semibold text-foreground/80">How tier thresholds work</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The four lower tiers (Novice → Thinker → Scholar → Intellectual) are automatically
          distributed at 10%, 30%, and 60% of the Elite Thinker threshold, so the ladder
          always scales proportionally. Changing this value takes effect immediately on the
          server — no restart required.
        </p>
      </div>
    </div>
  );
}
