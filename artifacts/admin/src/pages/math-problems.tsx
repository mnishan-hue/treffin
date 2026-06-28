import { useState } from "react";
import { api } from "@/lib/api";

interface MathProblem {
  id: number;
  userId: string;
  userName: string;
  title: string;
  categoryName: string;
  difficulty: string;
  status: string;
  solutionCount: number;
  viewCount: number;
  isFeatured: boolean;
  isProblemOfWeek: boolean;
  createdAt: string;
}

interface MathSolution {
  id: number;
  userName: string;
  approach: string;
  qualityScore: number;
  isAccepted: boolean;
  isFeatured: boolean;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400",
  intermediate: "bg-blue-500/20 text-blue-400",
  advanced: "bg-amber-500/20 text-amber-400",
  olympiad: "bg-red-500/20 text-red-400",
  research: "bg-purple-500/20 text-purple-400",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-500/20 text-emerald-400",
  locked: "bg-amber-500/20 text-amber-400",
  archived: "bg-gray-500/20 text-gray-400",
};

export default function MathProblems() {
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<MathProblem | null>(null);
  const [solutions, setSolutions] = useState<MathSolution[]>([]);
  const [solutionsLoading, setSolutionsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<MathProblem[]>("/math/problems?limit=50");
      setProblems(data);
      setLoaded(true);
    } catch {
      setMessage("Failed to load problems");
    } finally {
      setLoading(false);
    }
  };

  const selectProblem = async (p: MathProblem) => {
    setSelectedProblem(p);
    setSolutionsLoading(true);
    try {
      const data = await api.get<{ solutions: MathSolution[] }>(`/math/problems/${p.id}`);
      setSolutions(data.solutions);
    } catch {
      setSolutions([]);
    } finally {
      setSolutionsLoading(false);
    }
  };

  const deleteItem = async (type: "problem" | "solution", id: number) => {
    if (!confirm(`Permanently delete this ${type}? This cannot be undone.`)) return;
    try {
      const endpoint = type === "problem"
        ? `/admin/math-problems/${id}`
        : `/admin/math-solutions/${id}`;
      await api.delete(endpoint);
      setMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} #${id} deleted.`);
      if (type === "problem") {
        setProblems((prev) => prev.filter((p) => p.id !== id));
        if (selectedProblem?.id === id) { setSelectedProblem(null); setSolutions([]); }
      } else {
        setSolutions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      setMessage(`Failed to delete ${type} — try again.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Math Problems</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and manage submitted problems and solutions</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Loading..." : loaded ? "Refresh" : "Load Problems"}
        </button>
      </div>

      {message && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Problems ({problems.length})
          </h2>
          {!loaded && !loading && (
            <div className="text-center py-8 text-muted-foreground text-sm border border-border rounded-lg">
              Click "Load Problems" to begin
            </div>
          )}
          {problems.map((p) => (
            <div
              key={p.id}
              onClick={() => void selectProblem(p)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedProblem?.id === p.id
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">by {p.userName}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); void deleteItem("problem", p.id); }}
                  className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${DIFFICULTY_COLORS[p.difficulty] ?? "bg-gray-500/20 text-gray-400"}`}>
                  {p.difficulty}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                  {p.status}
                </span>
                <span className="text-[10px] text-muted-foreground">{p.categoryName}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{p.solutionCount} solutions</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Solutions {selectedProblem ? `for #${selectedProblem.id}` : ""}
          </h2>
          {!selectedProblem && (
            <div className="text-center py-8 text-muted-foreground text-sm border border-border rounded-lg">
              Select a problem to view solutions
            </div>
          )}
          {solutionsLoading && (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading solutions...</div>
          )}
          {solutions.map((s) => (
            <div key={s.id} className="p-3 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.userName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Approach: <span className="text-foreground">{s.approach}</span>
                  </p>
                </div>
                <button
                  onClick={() => void deleteItem("solution", s.id)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-muted-foreground">Quality: {s.qualityScore}</span>
                {s.isAccepted && <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">Accepted</span>}
                {s.isFeatured && <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-medium">Featured</span>}
              </div>
            </div>
          ))}
          {selectedProblem && !solutionsLoading && solutions.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">No solutions yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
