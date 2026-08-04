import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gavel, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { useAdminFetch } from "../hooks/use-admin-fetch";

interface Appeal {
  id: number;
  userId: string;
  contentType: string;
  contentId: number;
  reason: string;
  status: "open" | "approved" | "denied";
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<Appeal["status"], { label: string; class: string; Icon: React.ComponentType<{ className?: string }> }> = {
  open:     { label: "Open",     class: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", Icon: Clock },
  approved: { label: "Approved", class: "text-green-400 bg-green-400/10 border-green-400/20",   Icon: CheckCircle },
  denied:   { label: "Denied",   class: "text-red-400 bg-red-400/10 border-red-400/20",          Icon: XCircle },
};

export default function Appeals() {
  const adminFetch = useAdminFetch();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | Appeal["status"]>("open");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const query = useQuery<Appeal[]>({
    queryKey: ["admin-appeals", filter],
    queryFn: () =>
      adminFetch(`/api/admin/appeals${filter !== "all" ? `?status=${filter}` : ""}`).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "denied" }) =>
      adminFetch(`/api/admin/appeals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewNote: reviewNote.trim() || undefined }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appeals"] });
      setReviewingId(null);
      setReviewNote("");
    },
  });

  const appeals = query.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gavel className="w-6 h-6 text-primary" /> Content Appeals</h1>
          <p className="text-muted-foreground text-sm mt-1">Review user appeals for removed content.</p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "open", "approved", "denied"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize transition-colors ${filter === s ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
          <button onClick={() => query.refetch()} className="flex items-center gap-1 text-sm border border-border px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : appeals.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No appeals{filter !== "all" ? ` with status "${filter}"` : ""} found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {appeals.map((appeal) => {
            const { label, class: cls, Icon } = STATUS_STYLE[appeal.status];
            const isReviewing = reviewingId === appeal.id;
            return (
              <div key={appeal.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize ${cls}`}>
                        <Icon className="w-3 h-3 inline mr-1" />{label}
                      </span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{appeal.contentType} #{appeal.contentId}</span>
                      <span className="text-xs text-muted-foreground">{new Date(appeal.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">User: <span className="font-mono">{appeal.userId.slice(0, 16)}…</span></p>
                  </div>
                  {appeal.status === "open" && (
                    <button
                      onClick={() => setReviewingId(isReviewing ? null : appeal.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                    >
                      {isReviewing ? "Cancel" : "Review"}
                    </button>
                  )}
                </div>

                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Appeal reason:</p>
                  <p className="text-sm">{appeal.reason}</p>
                </div>

                {appeal.reviewNote && (
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Review note:</p>
                    <p className="text-sm">{appeal.reviewNote}</p>
                  </div>
                )}

                {isReviewing && (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <input
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground"
                      placeholder="Optional review note to the user…"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewMutation.mutate({ id: appeal.id, status: "approved" })}
                        disabled={reviewMutation.isPending}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-full hover:bg-green-600/30 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve (Restore Content)
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate({ id: appeal.id, status: "denied" })}
                        disabled={reviewMutation.isPending}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-red-600/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-full hover:bg-red-600/20 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Deny
                      </button>
                    </div>
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
