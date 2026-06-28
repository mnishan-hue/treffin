import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminReviewRequest {
  id: number;
  articleId: number;
  articleTitle: string;
  requesterId: number;
  requesterName: string;
  status: "pending" | "approved" | "rejected";
  reviewerNote: string | null;
  createdAt: string;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function ReviewRequests() {
  const [requests, setRequests] = useState<AdminReviewRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const status = filter === "all" ? undefined : filter;
      const url = status ? `/admin/review-requests?status=${status}` : "/admin/review-requests";
      setRequests(await api.get<AdminReviewRequest[]>(url));
    } catch {
      setErrorMsg("Failed to load review requests. Please refresh.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    setErrorMsg(null);
    try {
      await api.patch(`/admin/review-requests/${id}`, { status: "approved" });
      await load();
    } catch {
      setErrorMsg("Failed to approve request. Please try again.");
    }
    setActionLoading(null);
  };

  const handleReject = async (id: number) => {
    setActionLoading(id);
    setErrorMsg(null);
    try {
      await api.patch(`/admin/review-requests/${id}`, { status: "rejected", reviewerNote: rejectNote.trim() || undefined });
      setRejectingId(null);
      setRejectNote("");
      await load();
    } catch {
      setErrorMsg("Failed to reject request. Please try again.");
    }
    setActionLoading(null);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const statusBadge = (status: AdminReviewRequest["status"]) => {
    if (status === "approved") return (
      <span className="text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Approved</span>
    );
    if (status === "rejected") return (
      <span className="text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full">Rejected</span>
    );
    return (
      <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Pending</span>
    );
  };

  const filterTabs: { id: StatusFilter; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "all", label: "All" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-foreground">Review Requests</h2>
        {pendingCount > 0 && filter !== "pending" && (
          <span className="text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
            {pendingCount} pending
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="mb-3 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-destructive/70 hover:text-destructive shrink-0 text-xs">Dismiss</button>
        </div>
      )}

      <div className="flex bg-card border border-border rounded-xl overflow-hidden mb-4">
        {filterTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`flex-1 py-2.5 min-h-[40px] text-sm capitalize transition-colors text-center ${
              filter === t.id
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground py-8 text-center">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">
          {filter === "pending" ? "No pending review requests — all clear!" : "No requests found"}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => {
            const isLoading = actionLoading === r.id;
            const isRejecting = rejectingId === r.id;

            return (
              <div key={r.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-foreground text-sm leading-snug flex-1">{r.articleTitle}</p>
                    {statusBadge(r.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>by {r.requesterName}</span>
                    <span>·</span>
                    <span>{formatDate(r.createdAt)}</span>
                  </div>
                  {r.reviewerNote && (
                    <p className="mt-2 text-xs text-muted-foreground italic bg-muted/30 px-3 py-2 rounded-lg">
                      Note: {r.reviewerNote}
                    </p>
                  )}
                </div>

                {r.status === "pending" && (
                  <div className="border-t border-border/50 bg-accent/5 px-4 py-2.5">
                    {isRejecting ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="Optional rejection note…"
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleReject(r.id)}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            disabled={isLoading}
                            onClick={() => handleReject(r.id)}
                            className="text-xs px-3 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium min-h-[36px] disabled:opacity-50"
                          >
                            {isLoading ? "Rejecting…" : "Confirm Reject"}
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectNote(""); }}
                            className="text-xs px-3 py-2 bg-secondary text-secondary-foreground rounded-lg min-h-[36px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          disabled={isLoading}
                          onClick={() => handleApprove(r.id)}
                          className="text-xs px-3 py-2.5 bg-green-500/15 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500 hover:text-white transition-colors min-h-[40px] disabled:opacity-50 font-medium"
                        >
                          {isLoading ? "Approving…" : "Approve"}
                        </button>
                        <button
                          disabled={isLoading}
                          onClick={() => setRejectingId(r.id)}
                          className="text-xs px-3 py-2.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive hover:text-white transition-colors min-h-[40px] disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
