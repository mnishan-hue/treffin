import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Section } from "@/components/layout/sidebar";

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalDebates: number;
  totalArticles: number;
  totalCommunities: number;
  repEventsToday: number;
  mostActiveUser: string | null;
  openAppeals: number;
  flaggedPosts: number;
  pendingReviews: number;
  highRiskUsers: number;
}

interface AuditEntry {
  id: number;
  action: string;
  targetType: string | null;
  targetId: number | null;
  adminNote: string | null;
  createdAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  auto_parliamentary_warning: "text-amber-400",
  freeze_debate: "text-blue-400",
  unfreeze_debate: "text-emerald-400",
  remove_comment: "text-red-400",
  remove_post: "text-red-400",
  approve_appeal: "text-emerald-400",
  deny_appeal: "text-orange-400",
};

interface ActionCardProps {
  label: string;
  count: number;
  description: string;
  section: Section;
  urgency: "critical" | "warning" | "info";
  onNavigate: (s: Section) => void;
}

function ActionCard({ label, count, description, section, urgency, onNavigate }: ActionCardProps) {
  const active = count > 0;
  const border = active
    ? urgency === "critical" ? "border-red-500/40 bg-red-500/8" : urgency === "warning" ? "border-amber-500/40 bg-amber-500/8" : "border-blue-500/40 bg-blue-500/8"
    : "border-border bg-card";
  const countColor = active
    ? urgency === "critical" ? "text-red-400" : urgency === "warning" ? "text-amber-400" : "text-blue-400"
    : "text-foreground";
  const btnColor = active
    ? urgency === "critical" ? "bg-red-500/15 text-red-400 hover:bg-red-500/25" : urgency === "warning" ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25" : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
    : "bg-accent text-muted-foreground hover:bg-accent/80";

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 transition-all ${border}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {active && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${urgency === "critical" ? "bg-red-500/20 text-red-400" : urgency === "warning" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
            {urgency === "critical" ? "ACTION" : urgency === "warning" ? "REVIEW" : "PENDING"}
          </span>
        )}
      </div>
      <p className={`text-4xl font-bold leading-none ${countColor}`}>{count}</p>
      <p className="text-xs text-muted-foreground flex-1">{description}</p>
      <button
        onClick={() => onNavigate(section)}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors self-start ${btnColor}`}
      >
        Go to {label} →
      </button>
    </div>
  );
}

export default function Analytics({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLog, setRecentLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = () => {
    setLoading(true);
    Promise.all([
      api.get<Stats>("/admin/stats"),
      api.get<AuditEntry[]>("/admin/audit-log"),
    ])
      .then(([s, log]) => {
        setStats(s);
        setRecentLog(Array.isArray(log) ? log.slice(0, 6) : []);
        setError("");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-3">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading…
      </div>
    );
  }

  if (error) return <div className="text-destructive p-4 text-sm">{error}</div>;
  if (!stats) return null;

  const totalPending = stats.flaggedPosts + stats.openAppeals + stats.pendingReviews + stats.highRiskUsers;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Command Center</h2>
          <p className={`text-sm mt-0.5 ${totalPending > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {totalPending > 0
              ? `⚠ ${totalPending} item${totalPending !== 1 ? "s" : ""} need attention`
              : "✓ All clear — no pending items"}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-accent text-muted-foreground rounded-lg hover:bg-accent/80 disabled:opacity-40 transition-colors"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {/* Action Cards */}
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Needs Attention
        </h3>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <ActionCard
            label="Flagged Posts"
            count={stats.flaggedPosts}
            description="Posts auto-flagged by community reports"
            section="moderation"
            urgency="critical"
            onNavigate={onNavigate}
          />
          <ActionCard
            label="Open Appeals"
            count={stats.openAppeals}
            description="Users appealing removed content"
            section="appeals"
            urgency="warning"
            onNavigate={onNavigate}
          />
          <ActionCard
            label="Pending Reviews"
            count={stats.pendingReviews}
            description="Article peer review requests"
            section="review-requests"
            urgency="info"
            onNavigate={onNavigate}
          />
          <ActionCard
            label="High-Risk Users"
            count={stats.highRiskUsers}
            description="5+ reports on their posts in last 24h"
            section="users"
            urgency="critical"
            onNavigate={onNavigate}
          />
        </div>
      </section>

      {/* Platform Metrics */}
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Platform Overview
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Users", value: stats.totalUsers, icon: "👤" },
            { label: "Posts", value: stats.totalPosts, icon: "📝" },
            { label: "Debates", value: stats.totalDebates, icon: "⚡" },
            { label: "Articles", value: stats.totalArticles, icon: "📰" },
            { label: "Communities", value: stats.totalCommunities, icon: "🏛️" },
            { label: "Rep Today", value: stats.repEventsToday, icon: "🏆" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-xl mb-1">{icon}</div>
              <p className="text-lg font-bold text-foreground">{value.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
        {stats.mostActiveUser && (
          <div className="mt-2 bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-2.5">
            <span className="text-base">🌟</span>
            <span className="text-sm text-muted-foreground">Most active today:</span>
            <span className="text-sm font-semibold text-foreground">{stats.mostActiveUser}</span>
          </div>
        )}
      </section>

      {/* Recent Moderation Log */}
      {recentLog.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Recent Moderation
            </h3>
            <button
              onClick={() => onNavigate("audit-log")}
              className="text-xs text-primary hover:underline"
            >
              Full log →
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/50">
            {recentLog.map((entry) => (
              <div key={entry.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`text-[11px] font-mono font-semibold shrink-0 min-w-[140px] ${ACTION_COLOR[entry.action] ?? "text-muted-foreground"}`}>
                  {entry.action.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {entry.adminNote ?? `${entry.targetType ?? "?"} #${entry.targetId}`}
                </span>
                <span className="text-[10px] text-muted-foreground/50 shrink-0">
                  {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Nav */}
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Quick Navigation
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {(
            [
              { section: "moderation", label: "Moderation", icon: "🛡️" },
              { section: "comments", label: "Comments", icon: "💬" },
              { section: "users", label: "Users", icon: "👥" },
              { section: "outcomes", label: "Debate Outcomes", icon: "⚖️" },
              { section: "daily-question", label: "Daily Question", icon: "❓" },
              { section: "trending", label: "Trending", icon: "🔥" },
              { section: "featured", label: "Featured", icon: "⭐" },
              { section: "weekly-challenge", label: "Weekly Challenge", icon: "🏆" },
            ] as { section: Section; label: string; icon: string }[]
          ).map(({ section, label, icon }) => (
            <button
              key={section}
              onClick={() => onNavigate(section)}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors text-left"
            >
              <span>{icon}</span>
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
