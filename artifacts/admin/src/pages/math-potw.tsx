import { useState } from "react";
import { api } from "@/lib/api";

interface MathProblem {
  id: number;
  title: string;
  userName: string;
  categoryName: string;
  difficulty: string;
  solutionCount: number;
}

interface MathPotw {
  id: number;
  problemId: number;
  weekStart: string;
  weekEnd: string;
  note: string | null;
  problem: MathProblem;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400",
  intermediate: "bg-blue-500/20 text-blue-400",
  advanced: "bg-amber-500/20 text-amber-400",
  olympiad: "bg-red-500/20 text-red-400",
  research: "bg-purple-500/20 text-purple-400",
};

export default function MathPotw() {
  const [potw, setPotw] = useState<MathPotw | null>(null);
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedProblemId, setSelectedProblemId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [potwResult, problemsResult] = await Promise.allSettled([
        api.get<MathPotw>("/math/problem-of-week"),
        api.get<MathProblem[]>("/math/problems?limit=50"),
      ]);

      setPotw(potwResult.status === "fulfilled" ? potwResult.value : null);
      if (problemsResult.status === "fulfilled") setProblems(problemsResult.value);
      setLoaded(true);
    } catch {
      setMessage("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const setPotwHandler = async () => {
    if (!selectedProblemId) {
      setMessage("Please select a problem");
      return;
    }
    setSubmitting(true);
    try {
      await api.put("/admin/math-potw", { problemId: Number(selectedProblemId), note: note || undefined });
      setMessage(`Problem #${selectedProblemId} is now the Problem of the Week!`);
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to set POTW");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Problem of the Week</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage the weekly featured math problem</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Loading..." : loaded ? "Refresh" : "Load Data"}
        </button>
      </div>

      {message && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary font-mono whitespace-pre-wrap">
          {message}
        </div>
      )}

      {loaded && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Current Problem of the Week</h2>
          {!potw ? (
            <div className="p-4 rounded-lg border border-border bg-card text-center text-muted-foreground text-sm">
              No active Problem of the Week set
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <span className="text-lg text-primary font-bold">★</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{potw.problem.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">by {potw.problem.userName}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY_COLORS[potw.problem.difficulty] ?? "bg-gray-500/20 text-gray-400"}`}>
                      {potw.problem.difficulty}
                    </span>
                    <span className="text-xs text-muted-foreground">{potw.problem.categoryName}</span>
                    <span className="text-xs text-muted-foreground">{potw.problem.solutionCount} solutions</span>
                  </div>
                  {potw.note && <p className="text-sm text-muted-foreground mt-2 italic">{potw.note}</p>}
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(potw.weekStart).toLocaleDateString()} — {new Date(potw.weekEnd).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {loaded && problems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Set New Problem of the Week</h2>
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Select Problem</label>
              <select
                value={selectedProblemId}
                onChange={(e) => setSelectedProblemId(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">-- Choose a problem --</option>
                {problems.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} — {p.title} ({p.difficulty})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Editor Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add context or commentary for this problem..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
            <button
              onClick={setPotwHandler}
              disabled={submitting || !selectedProblemId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? "Setting..." : "Set as Problem of the Week"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
