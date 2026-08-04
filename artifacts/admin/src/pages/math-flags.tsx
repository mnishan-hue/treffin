import { useState } from "react";
import { api } from "@/lib/api";

interface MathFlag {
  id: number;
  targetType: string;
  targetId: number;
  userId: string;
  reason: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export default function MathFlags() {
  const [flags, setFlags] = useState<MathFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<MathFlag[]>("/admin/math-flags");
      setFlags(data);
      setLoaded(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load flags";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resolve = async (id: number, status: "resolved" | "dismissed") => {
    try {
      await api.put(`/admin/math-flags/${id}/resolve`, { status });
      setFlags((prev) => prev.map((f) => f.id === id ? { ...f, status, resolvedAt: new Date().toISOString() } : f));
    } catch {
      setError("Failed to resolve flag — try again");
    }
  };

  const pendingFlags = flags.filter((f) => f.status === "pending");
  const resolvedFlags = flags.filter((f) => f.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Math Content Flags</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review community-flagged problems and solutions</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Loading..." : loaded ? "Refresh" : "Load Flags"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loaded && !error && (
        <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-lg">
          Click "Load Flags" to view flagged content
        </div>
      )}

      {loaded && flags.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-lg">
          No flags found
        </div>
      )}

      {pendingFlags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Pending ({pendingFlags.length})
          </h2>
          {pendingFlags.map((f) => (
            <div key={f.id} className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                      {f.targetType} #{f.targetId}
                    </span>
                    <span className="text-xs text-muted-foreground">by {f.userId}</span>
                  </div>
                  <p className="text-sm text-foreground">{f.reason}</p>
                  <p className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => void resolve(f.id, "resolved")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => void resolve(f.id, "dismissed")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolvedFlags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resolved ({resolvedFlags.length})
          </h2>
          {resolvedFlags.map((f) => (
            <div key={f.id} className="p-3 rounded-lg border border-border bg-card opacity-60">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                  {f.targetType} #{f.targetId}
                </span>
                <p className="text-sm text-muted-foreground truncate">{f.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
