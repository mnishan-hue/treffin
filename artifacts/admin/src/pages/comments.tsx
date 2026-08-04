import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminComment {
  id: number;
  postId: number | null;
  debateId: number | null;
  authorId: number;
  authorName: string;
  content: string;
  isFlagged: boolean;
  flagLabel: string | null;
  createdAt: string;
}

export default function Comments() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get<AdminComment[]>("/admin/comments")
      .then(setComments)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    await api.delete(`/admin/comments/${id}`);
    setConfirmId(null);
    load();
  };

  const handleFlag = async (id: number, isFlagged: boolean, flagLabel?: string) => {
    setBusyId(id);
    await api.patch(`/admin/comments/${id}/flag`, { isFlagged, flagLabel: flagLabel ?? null });
    setBusyId(null);
    load();
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Comments & Replies</h2>

      {comments.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">No comments yet</div>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-foreground">{c.authorName}</span>
                    {c.debateId ? (
                      <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">Debate #{c.debateId}</span>
                    ) : c.postId ? (
                      <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">Post #{c.postId}</span>
                    ) : null}
                    {c.isFlagged && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        c.flagLabel === "strong"
                          ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      }`}>
                        {c.flagLabel === "strong" ? "💪 Strong" : "✅ Fair"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{c.content}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">{new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-border/50">
                {confirmId === c.id ? (
                  <>
                    <span className="text-xs text-muted-foreground">Delete this comment?</span>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 font-medium"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleFlag(c.id, true, "strong")}
                      disabled={busyId === c.id}
                      className="text-xs px-2.5 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                    >
                      💪 Strong
                    </button>
                    <button
                      onClick={() => handleFlag(c.id, true, "fair")}
                      disabled={busyId === c.id}
                      className="text-xs px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      ✅ Fair
                    </button>
                    {c.isFlagged && (
                      <button
                        onClick={() => handleFlag(c.id, false)}
                        disabled={busyId === c.id}
                        className="text-xs px-2.5 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        Unflag
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmId(c.id)}
                      className="text-xs px-2.5 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive hover:text-white transition-colors ml-auto"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
