import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Import only the TypeScript types from the generated client — not the hooks.
// The generated hooks use customFetch which sends a Better Auth session cookie
// Generated public hooks do not include the credentialed admin session or CSRF policy.
// We use useAdminFetch (which includes credentials and CSRF protection) with manual useQuery /
// useMutation instead.
import type {
  DebateCreatorReport,
} from "@workspace/api-client-react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import DebateModeration from "@/pages/debate-moderation";

type ResolveCreatorReportInputStatus = "dismissed" | "upheld";

const CREATOR_REPORTS_QUERY_KEY = ["admin-debate-creator-reports"] as const;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  upheld: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  upheld: "Upheld",
  dismissed: "Dismissed",
};

interface ResolvePanel {
  report: DebateCreatorReport;
  status: ResolveCreatorReportInputStatus;
  adminNote: string;
}

export default function CreatorReports() {
  const queryClient = useQueryClient();
  const adminFetch = useAdminFetch();

  const { data: reports = [], isLoading } = useQuery<DebateCreatorReport[]>({
    queryKey: CREATOR_REPORTS_QUERY_KEY,
    queryFn: () =>
      adminFetch("/api/admin/debate-creator-reports").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const resolve = useMutation({
    mutationFn: ({ id, status, adminNote }: { id: number; status: ResolveCreatorReportInputStatus; adminNote?: string }) =>
      adminFetch(`/api/admin/debate-creator-reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, adminNote }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CREATOR_REPORTS_QUERY_KEY });
      setPanel(null);
    },
  });

  const [panel, setPanel] = useState<ResolvePanel | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("pending");
  const [moderatingDebate, setModeratingDebate] = useState<{
    debateId: number;
    debateTitle: string;
    adminModerating: boolean;
  } | null>(null);

  const filtered = reports.filter((r) => {
    if (filter === "pending") return r.status === "pending";
    if (filter === "resolved") return r.status !== "pending";
    return true;
  });

  const openResolve = (report: DebateCreatorReport) => {
    setPanel({ report, status: "dismissed", adminNote: "" });
  };

  const handleSubmit = () => {
    if (!panel) return;
    resolve.mutate({ id: panel.report.id, status: panel.status, adminNote: panel.adminNote || undefined });
  };

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center text-sm">Loading…</div>;
  }

  // Delegate to the debate moderation view when an admin opens it
  if (moderatingDebate) {
    return (
      <DebateModeration
        debateId={moderatingDebate.debateId}
        debateTitle={moderatingDebate.debateTitle}
        adminModerating={moderatingDebate.adminModerating}
        onBack={() => setModeratingDebate(null)}
        onControlChanged={() => {
          // Toggle adminModerating in local state so the button label flips instantly
          setModeratingDebate(prev => prev ? { ...prev, adminModerating: !prev.adminModerating } : null);
          queryClient.invalidateQueries({ queryKey: CREATOR_REPORTS_QUERY_KEY });
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-foreground">Creator Fairness Reports</h2>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {(["pending", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground text-sm">
          {filter === "pending" ? "No pending creator reports 🎉" : "No reports in this category"}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((report) => (
            <div key={report.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        STATUS_STYLES[report.status] ?? STATUS_STYLES.dismissed
                      }`}
                    >
                      {STATUS_LABELS[report.status] ?? report.status}
                    </span>
                    {report.debateTitle && (
                      <a
                        href={`/debates/${report.debateId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors truncate max-w-[240px]"
                        title="Open debate in Treffin"
                      >
                        🔗 <span className="text-foreground font-medium">{report.debateTitle}</span>
                      </a>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm text-foreground mt-1 leading-relaxed">{report.reason}</p>

                  {report.adminNote && (
                    <p className="text-xs text-muted-foreground mt-2 italic border-t border-border pt-2">
                      Admin note: {report.adminNote}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Creator: <code className="text-foreground font-mono">{report.creatorUserId.slice(0, 12)}…</code></span>
                    {report.reporterUserId && (
                      <span>Reporter: <code className="text-foreground font-mono">{report.reporterUserId.slice(0, 12)}…</code></span>
                    )}
                    {report.resolvedAt && (
                      <span>Resolved {new Date(report.resolvedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {report.status === "pending" && (
                    <button
                      onClick={() => openResolve(report)}
                      className="text-xs px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors whitespace-nowrap"
                    >
                      Review
                    </button>
                  )}
                  {report.status === "upheld" && report.debateId && (
                    <button
                      onClick={() => setModeratingDebate({
                        debateId: report.debateId!,
                        debateTitle: report.debateTitle ?? `Debate #${report.debateId}`,
                        adminModerating: (report as any).adminModerating ?? false,
                      })}
                      className="text-xs px-3 py-1.5 bg-violet-500/10 text-violet-400 border border-violet-500/25 rounded-lg hover:bg-violet-500/20 transition-colors whitespace-nowrap"
                    >
                      🛡 Moderate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review panel */}
      {panel && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-end"
          onClick={() => setPanel(null)}
        >
          <div
            className="w-full sm:max-w-lg sm:h-full bg-card border-t sm:border-t-0 sm:border-l border-border overflow-y-auto rounded-t-2xl sm:rounded-none max-h-[90vh] sm:max-h-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-start justify-between sticky top-0 bg-card z-10">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="font-semibold text-foreground">Review Creator Report</h3>
                {panel.report.debateTitle && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{panel.report.debateTitle}</p>
                )}
              </div>
              <button onClick={() => setPanel(null)} className="text-muted-foreground hover:text-foreground p-1 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Report details */}
              <div className="bg-muted/40 rounded-lg p-4 text-sm text-foreground leading-relaxed">
                <p className="text-xs text-muted-foreground font-medium mb-1.5 uppercase tracking-wide">Reported reason</p>
                {panel.report.reason}
              </div>

              {/* Decision */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Decision</label>
                <div className="flex gap-2">
                  {(["dismissed", "upheld"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setPanel((p) => p ? { ...p, status: s } : p)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border capitalize transition-colors ${
                        panel.status === s
                          ? s === "upheld"
                            ? "bg-rose-500 text-white border-rose-500"
                            : "bg-secondary text-foreground border-border"
                          : "bg-background border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s === "upheld" ? "⚠️ Uphold (creator was unfair)" : "✓ Dismiss (no issue)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin note */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Admin note <span className="text-muted-foreground font-normal">(optional, shown to reporter)</span>
                </label>
                <textarea
                  value={panel.adminNote}
                  onChange={(e) => setPanel((p) => p ? { ...p, adminNote: e.target.value } : p)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                  placeholder="Explain your decision…"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={resolve.isPending}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {resolve.isPending ? "Submitting…" : "Submit Decision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
