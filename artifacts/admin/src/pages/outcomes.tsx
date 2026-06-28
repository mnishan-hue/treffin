import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminDebate {
  id: number;
  title: string;
  category: string;
  participantCount: number;
  isLive: boolean;
  isTrending: boolean;
  isFeatured: boolean;
  createdAt: string;
  hasOutcome: boolean;
}

interface DebateComment {
  id: number;
  authorId: number;
  authorName: string;
  content: string;
  side: string | null;
  isFlagged: boolean;
  flagLabel: string | null;
  createdAt: string;
}

interface AdjudicatePanel {
  debate: AdminDebate;
  comments: DebateComment[];
  winningSide: "support" | "against" | "draw";
  justification: string;
  topSupportId: string;
  topOppositionId: string;
}

export default function Outcomes() {
  const [debates, setDebates] = useState<AdminDebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<AdjudicatePanel | null>(null);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get<AdminDebate[]>("/admin/debates")
      .then(setDebates)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openPanel = async (debate: AdminDebate) => {
    setLoadingPanel(true);
    const comments = await api.get<DebateComment[]>(`/debates/${debate.id}/comments`).catch(() => []);
    setPanel({
      debate,
      comments,
      winningSide: "draw",
      justification: "",
      topSupportId: "",
      topOppositionId: "",
    });
    setLoadingPanel(false);
  };

  const handlePublish = async () => {
    if (!panel) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/debates/${panel.debate.id}/outcome`, {
        winningSide: panel.winningSide,
        justification: panel.justification,
        topSupportCommentId: panel.topSupportId ? Number(panel.topSupportId) : undefined,
        topOppositionCommentId: panel.topOppositionId ? Number(panel.topOppositionId) : undefined,
      });
      setSuccess(panel.debate.id);
      setPanel(null);
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch {}
    setSubmitting(false);
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Debate Outcomes</h2>
      {success && (
        <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm">
          ✅ Outcome published for debate #{success}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {debates.map((d) => (
          <div key={d.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm line-clamp-2">{d.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">{d.category} · {d.participantCount} participants</span>
                {d.hasOutcome ? (
                  <span className="text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">Adjudicated</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">Pending</span>
                )}
              </div>
            </div>
            <button
              onClick={() => openPanel(d)}
              disabled={loadingPanel}
              className="shrink-0 text-xs px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Adjudicate
            </button>
          </div>
        ))}
        {debates.length === 0 && (
          <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">No debates yet</div>
        )}
      </div>

      {panel && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-end" onClick={() => setPanel(null)}>
          <div
            className="w-full sm:max-w-lg sm:h-full bg-card border-t sm:border-t-0 sm:border-l border-border overflow-y-auto rounded-t-2xl sm:rounded-none max-h-[90vh] sm:max-h-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-start justify-between sticky top-0 bg-card z-10">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="font-semibold text-foreground">Adjudicate</h3>
                <p className="text-sm text-muted-foreground mt-0.5 leading-snug line-clamp-2">{panel.debate.title}</p>
              </div>
              <button onClick={() => setPanel(null)} className="text-muted-foreground hover:text-foreground p-1 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Winner</label>
                <div className="flex gap-2">
                  {(["support", "against", "draw"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setPanel((p) => p ? { ...p, winningSide: side } : p)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border capitalize transition-colors ${
                        panel.winningSide === side
                          ? side === "support" ? "bg-indigo-500 text-white border-indigo-500" : side === "against" ? "bg-rose-500 text-white border-rose-500" : "bg-secondary text-foreground border-border"
                          : "bg-background border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Justification</label>
                <textarea
                  value={panel.justification}
                  onChange={(e) => setPanel((p) => p ? { ...p, justification: e.target.value } : p)}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                  placeholder="Explain the ruling…"
                />
              </div>
              {panel.comments.length > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Top Support Argument</label>
                    <select
                      value={panel.topSupportId}
                      onChange={(e) => setPanel((p) => p ? { ...p, topSupportId: e.target.value } : p)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">None selected</option>
                      {panel.comments
                        .filter((c) => c.side === "support")
                        .map((c) => (
                          <option key={c.id} value={String(c.id)}>{c.authorName}: {c.content.slice(0, 80)}…</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Top Opposition Argument</label>
                    <select
                      value={panel.topOppositionId}
                      onChange={(e) => setPanel((p) => p ? { ...p, topOppositionId: e.target.value } : p)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">None selected</option>
                      {panel.comments
                        .filter((c) => c.side === "against")
                        .map((c) => (
                          <option key={c.id} value={String(c.id)}>{c.authorName}: {c.content.slice(0, 80)}…</option>
                        ))}
                    </select>
                  </div>
                </>
              )}
              <button
                onClick={handlePublish}
                disabled={submitting || !panel.justification.trim()}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Publishing…" : "Publish Ruling"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
