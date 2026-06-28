export type Section =
  | "analytics"
  | "moderation"
  | "comments"
  | "daily-question"
  | "outcomes"
  | "trending"
  | "featured"
  | "topics"
  | "users"
  | "weekly-challenge"
  | "review-requests"
  | "audit-log"
  | "appeals"
  | "math-problems"
  | "math-flags"
  | "math-potw"
  | "math-contests"
  | "database-tools";

interface NavItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
}

export interface UrgentCounts {
  flaggedPosts: number;
  pendingReviews: number;
  openAppeals: number;
}

const Icon = ({ path }: { path: string }) => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { id: "analytics", label: "Command Center", icon: <Icon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "moderation", label: "Moderation", icon: <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { id: "comments", label: "Comments", icon: <Icon path="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
      { id: "review-requests", label: "Review Requests", icon: <Icon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
      { id: "appeals", label: "Content Appeals", icon: <Icon path="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /> },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "users", label: "Users", icon: <Icon path="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
      { id: "outcomes", label: "Debate Outcomes", icon: <Icon path="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /> },
      { id: "daily-question", label: "Daily Question", icon: <Icon path="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { id: "weekly-challenge", label: "Weekly Challenge", icon: <Icon path="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /> },
    ],
  },
  {
    label: "Discovery",
    items: [
      { id: "trending", label: "Trending Control", icon: <Icon path="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
      { id: "featured", label: "Featured Content", icon: <Icon path="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> },
      { id: "topics", label: "Topics", icon: <Icon path="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /> },
    ],
  },
  {
    label: "Mathematics",
    items: [
      { id: "math-problems", label: "Problems", icon: <Icon path="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
      { id: "math-potw", label: "Problem of the Week", icon: <Icon path="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> },
      { id: "math-flags", label: "Math Flags", icon: <Icon path="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /> },
      { id: "math-contests", label: "Contests", icon: <Icon path="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /> },
    ],
  },
  {
    label: "Audit",
    items: [
      { id: "audit-log", label: "Audit Log", icon: <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
    ],
  },
  {
    label: "Developer",
    items: [
      { id: "database-tools", label: "Database Tools", icon: <Icon path="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /> },
    ],
  },
];

interface SidebarProps {
  active: Section;
  onSelect: (s: Section) => void;
  onLogout: () => void;
  onClose?: () => void;
  urgentCounts?: UrgentCounts;
}

function getBadge(id: Section, counts: UrgentCounts): string | null {
  if (id === "moderation" && counts.flaggedPosts > 0) return String(counts.flaggedPosts);
  if (id === "review-requests" && counts.pendingReviews > 0) return String(counts.pendingReviews);
  if (id === "appeals" && counts.openAppeals > 0) return String(counts.openAppeals);
  return null;
}

export default function Sidebar({ active, onSelect, onLogout, onClose, urgentCounts }: SidebarProps) {
  const totalUrgent = urgentCounts
    ? urgentCounts.flaggedPosts + urgentCounts.pendingReviews + urgentCounts.openAppeals
    : 0;

  return (
    <aside className="w-60 shrink-0 h-screen flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 overflow-hidden">
            <img src={`${import.meta.env.BASE_URL}treffin-mark.png`} alt="Treffin" className="w-5 h-5 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground leading-none truncate">Admin Panel</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Treffin Studio</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {totalUrgent > 0 && (
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex w-4 h-4 rounded-full bg-destructive/40 animate-ping opacity-60" />
              <span className="relative w-5 h-5 rounded-full bg-destructive flex items-center justify-center text-[9px] font-bold text-white leading-none">
                {totalUrgent > 99 ? "99" : totalUrgent}
              </span>
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors md:hidden"
              aria-label="Close menu"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Urgent summary banner */}
      {totalUrgent > 0 && urgentCounts && (
        <div className="mx-2 mt-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/25 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-[10px] text-destructive font-semibold leading-snug">
            {totalUrgent} item{totalUrgent !== 1 ? "s" : ""} need attention
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 select-none">
              {group.label}
            </p>
            {group.items.map((item) => {
              const badge = urgentCounts ? getBadge(item.id, urgentCounts) : null;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors text-left ${
                    active === item.id
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <span className={active === item.id ? "text-primary" : "text-muted-foreground/70"}>
                    {item.icon}
                  </span>
                  <span className="truncate flex-1">{item.label}</span>
                  {badge && (
                    <span className="ml-auto text-[10px] font-bold bg-destructive/20 text-destructive rounded-full px-1.5 py-0.5 leading-none shrink-0">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="truncate">Open Treffin App</span>
        </a>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
