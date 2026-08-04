import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Argument {
  id: number;
  authorName: string;
  content: string;
  side: "support" | "against" | null;
  isFlagged: boolean;
  flagLabel: string | null;
  isRemoved: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  createdAt: string;
}

interface Props {
  debateId: number;
  debateTitle: string;
  adminModerating: boolean;
  onBack: () => void;
  onControlChanged: () => void;
}

export default function DebateModeration({ debateId, debateTitle, adminModerating, onBack, onControlChanged }: Props) {
  const [args, setArgs] = useState<Argument[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [sideFilter, setSideFilter] = useState<"all" | "support" | "against" | "flagged">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Argument[]>(`/admin/debates/${debateId}/arguments`);
      setArgs(data);
    } finally {
      setLoading(false);
    }
  }, [debateId]);

  useEffect(() => { load(); }, [load]);

  const toggleControl = async () => {
    setToggling(true);
    try {
      await api.patch(`/admin/debates/${debateId}/take-control`, { active: !adminModerating });
      onControlChanged();
    } finally {
      setToggling(false);
    }
  };

  const pin = async (id: number, currentlyPinned: boolean) => {
    await api.patch(`/admin/debates/${debateId}/arguments/${id}/pin`, { pin: !currentlyPinned });
    setArgs(prev => prev.map(a => a.id === id ? { ...a, isPinned: !currentlyPinned } : a));
  };

  const feature = async (id: number, currentlyFeatured: boolean) => {
    await api.patch(`/admin/debates/${debateId}/arguments/${id}/feature`, { feature: !currentlyFeatured });
    setArgs(prev => prev.map(a => a.id === id ? { ...a, isFeatured: !currentlyFeatured } : a));
  };

  const remove = async (id: number) => {
    setRemoving(id);
    try {
      await api.delete(`/admin/debates/${debateId}/arguments/${id}`, { reason: removeReason || "Removed by admin" });
      setArgs(prev => prev.map(a => a.id === id ? { ...a, isRemoved: true } : a));
      setConfirmRemove(null);
      setRemoveReason("");
    } finally {
      setRemoving(null);
    }
  };

  const filtered = args.filter(a => {
    if (sideFilter === "flagged") return a.isFlagged && !a.isRemoved;
    if (sideFilter === "support") return a.side === "support" && !a.isRemoved;
    if (sideFilter === "against") return a.side === "against" && !a.isRemoved;
    return true;
  });

  const flaggedCount = args.filter(a => a.isFlagged && !a.isRemoved).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-foreground truncate">{debateTitle}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Debate #{debateId} — Admin Moderation</p>
        </div>
        <button
          onClick={toggleControl}
          disabled={toggling}
          className={cn(
            "shrink-0 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50",
            adminModerating
              ? "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
              : "bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20"
          )}
        >
          {toggling ? "…" : adminModerating ? "Release Control" : "Take Over Moderation"}
        </button>
      </div>

      {/* Status banner */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium",
        adminModerating
          ? "bg-violet-500/10 border-violet-500/25 text-violet-300"
          : "bg-muted/50 border-border text-muted-foreground"
      )}>
        {adminModerating ? (
          <>
            <span className="text-violet-400">🛡</span>
            Admin moderation is <strong className="text-violet-200">active</strong> — your pin/feature/remove actions below are live on this debate.
          </>
        ) : (
          <>
            <span>ℹ️</span>
            Admin moderation is off. Click "Take Over Moderation" to enable live pin/feature/remove actions.
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 self-start">
        {(["all", "support", "against", "flagged"] as const).map(f => (
          <button
            key={f}
            onClick={() => setSideFilter(f)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors flex items-center gap-1",
              sideFilter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "flagged" && flaggedCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-orange-400/20 text-orange-400 text-[10px] font-bold flex items-center justify-center">{flaggedCount}</span>
            )}
            {f}
          </button>
        ))}
      </div>

      {/* Arguments list */}
      {loading ? (
        <div className="text-center text-muted-foreground text-sm py-12">Loading arguments…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-12 border border-border rounded-xl bg-card">
          No arguments in this view
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(arg => (
            <div
              key={arg.id}
              className={cn(
                "bg-card border rounded-xl p-4 flex flex-col gap-2.5",
                arg.isRemoved ? "opacity-50 border-border" : arg.isFlagged ? "border-orange-400/30" : arg.isPinned ? "border-yellow-400/30" : arg.isFeatured ? "border-amber-400/25" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    arg.side === "support" ? "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" : arg.side === "against" ? "text-rose-400 bg-rose-400/10 border-rose-400/20" : "text-muted-foreground border-border"
                  )}>{arg.side ?? "—"}</span>
                  <span className="text-xs font-semibold text-foreground">{arg.authorName}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(arg.createdAt).toLocaleDateString()}</span>
                  {arg.isFlagged && !arg.isRemoved && (
                    <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-full">{arg.flagLabel ?? "Flagged"}</span>
                  )}
                  {arg.isPinned && <span className="text-[10px] font-bold text-yellow-400">📌 Pinned</span>}
                  {arg.isFeatured && <span className="text-[10px] font-bold text-amber-400">⭐ Featured</span>}
                  {arg.isRemoved && <span className="text-[10px] font-bold text-red-400">Removed</span>}
                </div>

                {!arg.isRemoved && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => pin(arg.id, arg.isPinned)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-lg border transition-colors",
                        arg.isPinned
                          ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/20"
                          : "text-muted-foreground border-border hover:text-yellow-400 hover:border-yellow-400/30"
                      )}
                    >
                      {arg.isPinned ? "Unpin" : "📌 Pin"}
                    </button>
                    <button
                      onClick={() => feature(arg.id, arg.isFeatured)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-lg border transition-colors",
                        arg.isFeatured
                          ? "bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20"
                          : "text-muted-foreground border-border hover:text-amber-400 hover:border-amber-400/30"
                      )}
                    >
                      {arg.isFeatured ? "Unfeature" : "⭐ Feature"}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(arg.id)}
                      className="text-xs px-2.5 py-1 rounded-lg border text-muted-foreground border-border hover:text-red-400 hover:border-red-400/30 transition-colors"
                    >
                      🗑 Remove
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed">{arg.content}</p>

              {/* Confirm remove inline */}
              {confirmRemove === arg.id && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <input
                    type="text"
                    placeholder="Removal reason (optional)"
                    value={removeReason}
                    onChange={e => setRemoveReason(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-red-500/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => remove(arg.id)}
                      disabled={removing === arg.id}
                      className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {removing === arg.id ? "Removing…" : "Confirm Remove"}
                    </button>
                    <button
                      onClick={() => { setConfirmRemove(null); setRemoveReason(""); }}
                      className="flex-1 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-medium hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
