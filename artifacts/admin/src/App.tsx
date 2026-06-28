import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { isAuthenticated, logout } from "@/lib/auth";
import { api } from "@/lib/api";
import Login from "@/pages/login";
import Sidebar, { type Section, type UrgentCounts } from "@/components/layout/sidebar";
import Analytics from "@/pages/analytics";
import Moderation from "@/pages/moderation";
import Comments from "@/pages/comments";
import DailyQuestion from "@/pages/daily-question";
import Outcomes from "@/pages/outcomes";
import Trending from "@/pages/trending";
import Featured from "@/pages/featured";
import Topics from "@/pages/topics";
import Users from "@/pages/users";
import WeeklyChallenge from "@/pages/weekly-challenge";
import ReviewRequests from "@/pages/review-requests";
import AuditLog from "@/pages/audit-log";
import Appeals from "@/pages/appeals";
import MathProblems from "@/pages/math-problems";
import MathFlags from "@/pages/math-flags";
import MathPotw from "@/pages/math-potw";
import MathContests from "@/pages/math-contests";
import DatabaseTools from "@/pages/database-tools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

const SECTION_LABELS: Record<Section, string> = {
  analytics: "Command Center",
  moderation: "Moderation",
  comments: "Comments",
  "daily-question": "Daily Question",
  outcomes: "Debate Outcomes",
  trending: "Trending Control",
  featured: "Featured Content",
  topics: "Topics",
  users: "Users",
  "weekly-challenge": "Weekly Challenge",
  "review-requests": "Review Requests",
  "audit-log": "Audit Log",
  appeals: "Content Appeals",
  "math-problems": "Math Problems",
  "math-flags": "Math Flags",
  "math-potw": "Problem of the Week",
  "math-contests": "Math Contests",
  "database-tools": "Database Tools",
};

function AdminShell() {
  const [section, setSection] = useState<Section>("analytics");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [urgentCounts, setUrgentCounts] = useState<UrgentCounts>({
    flaggedPosts: 0,
    pendingReviews: 0,
    openAppeals: 0,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUrgentCounts = async () => {
    try {
      const stats = await api.get<{
        flaggedPosts: number;
        pendingReviews: number;
        openAppeals: number;
      }>("/admin/stats");
      setUrgentCounts({
        flaggedPosts: stats.flaggedPosts ?? 0,
        pendingReviews: stats.pendingReviews ?? 0,
        openAppeals: stats.openAppeals ?? 0,
      });
    } catch {
      /* silently ignore — badges simply won't update */
    }
  };

  useEffect(() => {
    fetchUrgentCounts();
    pollRef.current = setInterval(fetchUrgentCounts, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const handleSelect = (s: Section) => {
    setSection(s);
    setSidebarOpen(false);
  };

  const renderSection = () => {
    switch (section) {
      case "analytics": return <Analytics onNavigate={setSection} />;
      case "moderation": return <Moderation />;
      case "comments": return <Comments />;
      case "daily-question": return <DailyQuestion />;
      case "outcomes": return <Outcomes />;
      case "trending": return <Trending />;
      case "featured": return <Featured />;
      case "topics": return <Topics />;
      case "users": return <Users />;
      case "weekly-challenge": return <WeeklyChallenge />;
      case "review-requests": return <ReviewRequests />;
      case "audit-log": return <AuditLog />;
      case "appeals": return <Appeals />;
      case "math-problems": return <MathProblems />;
      case "math-flags": return <MathFlags />;
      case "math-potw": return <MathPotw />;
      case "math-contests": return <MathContests />;
      case "database-tools": return <DatabaseTools />;
      default: return <Analytics onNavigate={setSection} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <Sidebar
          active={section}
          onSelect={handleSelect}
          onLogout={handleLogout}
          onClose={() => setSidebarOpen(false)}
          urgentCounts={urgentCounts}
        />
      </div>

      <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border md:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors -ml-1"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{SECTION_LABELS[section]}</p>
          </div>
        </div>

        <div className="flex-1 max-w-5xl w-full mx-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-8">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    isAuthenticated().then(setAuthed);
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <QueryClientProvider client={queryClient}>
        <Login onLogin={() => setAuthed(true)} />
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
