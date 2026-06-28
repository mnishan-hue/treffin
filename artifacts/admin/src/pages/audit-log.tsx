import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, RefreshCw, AlertTriangle, Trash2, Lock, Unlock, XCircle } from "lucide-react";
import { useAdminFetch } from "../hooks/use-admin-fetch";

interface AuditEntry {
  id: number;
  adminIdentifier: string | null;
  action: string;
  targetType: string;
  targetId: number;
  reason: string | null;
  meta: unknown;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  freeze_debate:    { label: "Freeze Debate",    color: "text-blue-400",   Icon: Lock },
  unfreeze_debate:  { label: "Unfreeze Debate",  color: "text-green-400",  Icon: Unlock },
  remove_comment:   { label: "Remove Comment",   color: "text-red-400",    Icon: Trash2 },
  remove_post:      { label: "Remove Post",      color: "text-red-400",    Icon: Trash2 },
  approve_appeal:   { label: "Approve Appeal",   color: "text-green-400",  Icon: Shield },
  deny_appeal:      { label: "Deny Appeal",      color: "text-orange-400", Icon: XCircle },
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, color: "text-muted-foreground", Icon: AlertTriangle };
}

export default function AuditLog() {
  const adminFetch = useAdminFetch();
  const [limit] = useState(100);

  const query = useQuery<AuditEntry[]>({
    queryKey: ["admin-audit-log", limit],
    queryFn: () =>
      adminFetch(`/api/admin/audit-log?limit=${limit}`).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const entries = query.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> Moderation Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-1">All admin moderation actions, newest first.</p>
        </div>
        <button
          onClick={() => query.refetch()}
          className="flex items-center gap-1.5 text-sm border border-border px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {query.isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No audit entries yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => {
            const { label, color, Icon } = actionMeta(entry.action);
            return (
              <div key={entry.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-start gap-3">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${color}`}>{label}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">{entry.targetType} #{entry.targetId}</span>
                    {entry.adminIdentifier && (
                      <span className="text-xs text-muted-foreground">by {entry.adminIdentifier}</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  {entry.reason && (
                    <p className="text-xs text-muted-foreground mt-1">Reason: {entry.reason}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
