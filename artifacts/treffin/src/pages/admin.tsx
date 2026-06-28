import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── helpers ─────────────────────────────────────────────────────────────── */

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function api<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

/* ── types ───────────────────────────────────────────────────────────────── */

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

interface AdminDebate {
  id: number;
  title: string;
  description: string | null;
  category: string;
  participantCount: number;
  isLive: boolean;
  isTrending: boolean;
  isFeatured: boolean;
  isFrozen: boolean;
  frozenReason: string | null;
  healthScore: number;
  createdAt: string;
  hasOutcome: boolean;
}

interface AdminArticle {
  id: number;
  title: string;
  excerpt: string | null;
  authorId: number;
  category: string | null;
  readTime: number;
  likes: number;
  isTrending: boolean;
  isFeatured: boolean;
  createdAt: string;
}

interface AdminPost {
  id: number;
  type: string;
  authorId: number;
  content: string | null;
  title: string | null;
  createdAt: string;
}

interface AdminCommunity {
  id: number;
  name: string;
  emoji: string;
  memberCount: number;
  totalPosts: number;
  isPrivate: boolean;
  isLive: boolean;
  createdAt: string;
}

interface AdminReport {
  id: number;
  postId: number;
  reporterUserId: string | null;
  reason: string | null;
  createdAt: string;
  postContent: string | null;
  postTitle: string | null;
  reportCount: number;
  isFlagged: boolean;
}

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

interface AdminUser {
  id: number;
  name: string;
  title: string;
  reputationScore: number;
  isVerified: boolean;
  createdAt: string;
}

interface AdminUserDetail extends AdminUser {
  bio: string | null;
  followers: number;
  following: number;
  debatesJoined: number;
  articlesPublished: number;
  streakDays: number;
  repHistory: { id: number; eventType: string; points: number; description: string; createdAt: string }[];
}

interface AdminTopic {
  id: number;
  name: string;
  color: string;
  slug: string | null;
  icon: string | null;
  description: string | null;
}

interface DailyQuestion {
  id: number;
  question: string;
  supportPercent: number;
  againstPercent: number;
  participantCount: number;
  isActive: boolean;
  imageUrl: string | null;
}

interface WeeklyChallenge {
  id: number;
  question: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  winnerUserId?: string | null;
  winnerName?: string | null;
  winnerResponse?: string | null;
}

interface Submission {
  id: number;
  challengeId: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  response: string;
  createdAt: string;
}

interface ReviewRequest {
  id: number;
  articleId: number;
  articleTitle: string;
  requesterId: number;
  requesterName: string;
  status: string;
  reviewerNote: string | null;
  createdAt: string;
}

interface Appeal {
  id: number;
  userId: string;
  contentType: string;
  contentId: number;
  reason: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface MathFlag {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  reporterUserId: string;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

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

/* ── nav sections ────────────────────────────────────────────────────────── */

const NAV_SECTIONS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "debates", label: "Debates", icon: "⚔️" },
  { id: "articles", label: "Articles", icon: "📝" },
  { id: "posts", label: "Posts", icon: "💬" },
  { id: "communities", label: "Communities", icon: "🏛️" },
  { id: "users", label: "Users", icon: "👤" },
  { id: "reports", label: "Reports", icon: "🚩" },
  { id: "comments", label: "Comments", icon: "💭" },
  { id: "topics", label: "Topics", icon: "🏷️" },
  { id: "daily-question", label: "Daily Question", icon: "❓" },
  { id: "weekly-challenge", label: "Weekly Challenge", icon: "🏆" },
  { id: "review-requests", label: "Review Requests", icon: "🔍" },
  { id: "appeals", label: "Appeals", icon: "⚖️" },
  { id: "math-flags", label: "Math Flags", icon: "🔢" },
  { id: "audit-log", label: "Audit Log", icon: "📋" },
];

/* ── small shared components ─────────────────────────────────────────────── */

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function Btn({
  onClick,
  children,
  variant = "default",
  disabled,
  className = "",
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "default" | "danger" | "ghost" | "success" | "warning";
  disabled?: boolean;
  className?: string;
}) {
  const colors = {
    default: "bg-indigo-600 hover:bg-indigo-500 text-white",
    danger: "bg-red-600/90 hover:bg-red-500 text-white",
    ghost: "bg-[#1e2d45]/60 hover:bg-[#1e2d45] text-slate-300",
    success: "bg-emerald-600/90 hover:bg-emerald-500 text-white",
    warning: "bg-amber-600/90 hover:bg-amber-500 text-white",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-white mb-4">{children}</h2>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0d1524] border border-[#1e2d45] rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#1e2d45]">
      <table className="w-full text-sm text-left">
        <thead className="bg-[#0a0f1a] text-slate-400 uppercase text-xs tracking-wide">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e2d45] text-slate-200">{children}</tbody>
      </table>
    </div>
  );
}

function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="hover:bg-[#0d1524]/60 transition-colors">{children}</tr>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#0d1524] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 ${className}`}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-[#0d1524] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
    />
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-16">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="bg-red-900/20 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
      {msg}
    </div>
  );
}

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
      >
        <p className="text-white text-base mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Login ───────────────────────────────────────────────────────────────── */

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("admin@treffin.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = await sha256hex(`${email}:${password}`);
      // verify against /admin/stats
      const res = await fetch(`${BASE}/api/admin/stats`, {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) throw new Error("Invalid credentials");
      localStorage.setItem("treffin_admin_token", token);
      onLogin(token);
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at top, #0d1830 0%, #060810 60%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🛡️</div>
          <h1 className="text-2xl font-bold text-white">Treffin Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Restricted access — authorised personnel only</p>
        </div>
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Admin Email</label>
              <Input value={email} onChange={setEmail} placeholder="admin@treffin.com" type="email" className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <Input value={password} onChange={setPassword} placeholder="••••••••" type="password" className="w-full" />
            </div>
            {error && <ErrorMsg msg={error} />}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-40"
            >
              {loading ? "Verifying…" : "Sign In"}
            </button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

/* ══ SECTIONS ════════════════════════════════════════════════════════════════ */

/* ── Overview ────────────────────────────────────────────────────────────── */

function Overview({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Stats>("GET", "/admin/stats", token)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!stats) return null;

  const tiles = [
    { label: "Total Users", value: stats.totalUsers, icon: "👤", color: "text-blue-400" },
    { label: "Total Posts", value: stats.totalPosts, icon: "💬", color: "text-purple-400" },
    { label: "Total Debates", value: stats.totalDebates, icon: "⚔️", color: "text-amber-400" },
    { label: "Total Articles", value: stats.totalArticles, icon: "📝", color: "text-emerald-400" },
    { label: "Communities", value: stats.totalCommunities, icon: "🏛️", color: "text-cyan-400" },
    { label: "Rep Events Today", value: stats.repEventsToday, icon: "⭐", color: "text-yellow-400" },
    { label: "Open Appeals", value: stats.openAppeals, icon: "⚖️", color: stats.openAppeals > 0 ? "text-red-400" : "text-slate-400" },
    { label: "Flagged Posts", value: stats.flaggedPosts, icon: "🚩", color: stats.flaggedPosts > 0 ? "text-red-400" : "text-slate-400" },
    { label: "Pending Reviews", value: stats.pendingReviews, icon: "🔍", color: stats.pendingReviews > 0 ? "text-amber-400" : "text-slate-400" },
    { label: "High-Risk Users", value: stats.highRiskUsers, icon: "⚠️", color: stats.highRiskUsers > 0 ? "text-red-400" : "text-slate-400" },
  ];

  return (
    <div>
      <SectionTitle>Platform Overview</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {tiles.map((t) => (
          <Card key={t.label} className="flex flex-col gap-1">
            <span className="text-2xl">{t.icon}</span>
            <span className={`text-2xl font-bold ${t.color}`}>{t.value.toLocaleString()}</span>
            <span className="text-xs text-slate-400">{t.label}</span>
          </Card>
        ))}
      </div>
      {stats.mostActiveUser && (
        <Card>
          <p className="text-sm text-slate-400">Most active user today</p>
          <p className="text-white font-semibold mt-1">🌟 {stats.mostActiveUser}</p>
        </Card>
      )}
    </div>
  );
}

/* ── Debates ─────────────────────────────────────────────────────────────── */

function OutcomeModal({
  debate,
  token,
  onClose,
  onDone,
}: {
  debate: AdminDebate;
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [side, setSide] = useState<"support" | "opposition">("support");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await api("POST", `/admin/debates/${debate.id}/outcome`, token, {
        winningSide: side,
        justification,
      });
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
      >
        <h3 className="text-white font-bold mb-1">Publish Outcome</h3>
        <p className="text-slate-400 text-xs mb-4 line-clamp-2">{debate.title}</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Winning Side</label>
            <div className="flex gap-2">
              {(["support", "opposition"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${side === s ? "bg-indigo-600 text-white" : "bg-[#1e2d45]/60 text-slate-300"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Justification</label>
            <Textarea value={justification} onChange={setJustification} placeholder="Explain the outcome…" rows={3} />
          </div>
          {error && <ErrorMsg msg={error} />}
          <div className="flex gap-3 justify-end">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn onClick={submit} disabled={saving || !justification.trim()}>{saving ? "Saving…" : "Publish"}</Btn>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FreezeModal({
  debate,
  token,
  onClose,
  onDone,
}: {
  debate: AdminDebate;
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const isFrozen = debate.isFrozen;

  async function submit() {
    setSaving(true);
    try {
      await api("PATCH", `/admin/debates/${debate.id}/freeze`, token, {
        isFrozen: !isFrozen,
        reason: reason || undefined,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
      >
        <h3 className="text-white font-bold mb-1">{isFrozen ? "Unfreeze Debate" : "Freeze Debate"}</h3>
        <p className="text-slate-400 text-xs mb-4 line-clamp-2">{debate.title}</p>
        {!isFrozen && (
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-1 block">Reason (optional)</label>
            <Input value={reason} onChange={setReason} placeholder="Why are you freezing this debate?" className="w-full" />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant={isFrozen ? "success" : "warning"} onClick={submit} disabled={saving}>
            {saving ? "…" : isFrozen ? "Unfreeze" : "Freeze"}
          </Btn>
        </div>
      </motion.div>
    </div>
  );
}

function Debates({ token }: { token: string }) {
  const [data, setData] = useState<AdminDebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ id: number; title: string } | null>(null);
  const [outcomeDebate, setOutcomeDebate] = useState<AdminDebate | null>(null);
  const [freezeDebate, setFreezeDebate] = useState<AdminDebate | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<AdminDebate[]>("GET", "/admin/debates", token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: number, field: "trending" | "featured", val: boolean) {
    await api("PATCH", `/admin/debates/${id}/${field}`, token, {
      [field === "trending" ? "isTrending" : "isFeatured"]: val,
    });
    load();
  }

  async function del(id: number) {
    await api("DELETE", `/admin/debates/${id}`, token);
    setConfirm(null);
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <SectionTitle>Debates ({data.length})</SectionTitle>
      <Table headers={["ID", "Title", "Category", "Participants", "Status", "Health", "Actions"]}>
        {data.map((d) => (
          <Tr key={d.id}>
            <Td className="text-slate-500 text-xs">{d.id}</Td>
            <Td>
              <div className="max-w-xs">
                <p className="font-medium truncate">{d.title}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {d.isLive && <Badge label="Live" color="bg-green-900/50 text-green-400" />}
                  {d.isTrending && <Badge label="Trending" color="bg-amber-900/50 text-amber-400" />}
                  {d.isFeatured && <Badge label="Featured" color="bg-purple-900/50 text-purple-400" />}
                  {d.isFrozen && <Badge label="Frozen" color="bg-blue-900/50 text-blue-400" />}
                  {d.hasOutcome && <Badge label="Outcome" color="bg-emerald-900/50 text-emerald-400" />}
                </div>
              </div>
            </Td>
            <Td><span className="text-slate-400 text-xs">{d.category}</span></Td>
            <Td className="text-center">{d.participantCount}</Td>
            <Td>
              <div className="flex gap-1 flex-wrap">
                <Btn variant="ghost" onClick={() => toggle(d.id, "trending", !d.isTrending)}>
                  {d.isTrending ? "−Trend" : "+Trend"}
                </Btn>
                <Btn variant="ghost" onClick={() => toggle(d.id, "featured", !d.isFeatured)}>
                  {d.isFeatured ? "−Feat" : "+Feat"}
                </Btn>
              </div>
            </Td>
            <Td>
              <span className={`text-xs font-medium ${d.healthScore >= 70 ? "text-green-400" : d.healthScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                {d.healthScore}
              </span>
            </Td>
            <Td>
              <div className="flex gap-1 flex-wrap">
                <Btn variant="warning" onClick={() => setFreezeDebate(d)}>
                  {d.isFrozen ? "Thaw" : "Freeze"}
                </Btn>
                <Btn variant="ghost" onClick={() => setOutcomeDebate(d)}>Outcome</Btn>
                <Btn variant="danger" onClick={() => setConfirm({ id: d.id, title: d.title })}>Delete</Btn>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
      {confirm && (
        <ConfirmModal
          message={`Delete debate "${confirm.title}"? This cannot be undone.`}
          onConfirm={() => del(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {outcomeDebate && (
        <OutcomeModal
          debate={outcomeDebate}
          token={token}
          onClose={() => setOutcomeDebate(null)}
          onDone={() => { setOutcomeDebate(null); load(); }}
        />
      )}
      {freezeDebate && (
        <FreezeModal
          debate={freezeDebate}
          token={token}
          onClose={() => setFreezeDebate(null)}
          onDone={() => { setFreezeDebate(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── Articles ────────────────────────────────────────────────────────────── */

function Articles({ token }: { token: string }) {
  const [data, setData] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ id: number; title: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<AdminArticle[]>("GET", "/admin/articles", token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: number, field: "trending" | "featured", val: boolean) {
    await api("PATCH", `/admin/articles/${id}/${field}`, token, {
      [field === "trending" ? "isTrending" : "isFeatured"]: val,
    });
    load();
  }

  async function del(id: number) {
    await api("DELETE", `/admin/articles/${id}`, token);
    setConfirm(null);
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <SectionTitle>Articles ({data.length})</SectionTitle>
      <Table headers={["ID", "Title", "Category", "Likes", "Read Time", "Flags", "Actions"]}>
        {data.map((a) => (
          <Tr key={a.id}>
            <Td className="text-slate-500 text-xs">{a.id}</Td>
            <Td>
              <div className="max-w-xs">
                <p className="font-medium truncate">{a.title}</p>
                <div className="flex gap-1 mt-1">
                  {a.isTrending && <Badge label="Trending" color="bg-amber-900/50 text-amber-400" />}
                  {a.isFeatured && <Badge label="Featured" color="bg-purple-900/50 text-purple-400" />}
                </div>
              </div>
            </Td>
            <Td><span className="text-slate-400 text-xs">{a.category ?? "—"}</span></Td>
            <Td className="text-center">{a.likes}</Td>
            <Td className="text-center text-slate-400 text-xs">{a.readTime}m</Td>
            <Td>
              <div className="flex gap-1">
                <Btn variant="ghost" onClick={() => toggle(a.id, "trending", !a.isTrending)}>
                  {a.isTrending ? "−Trend" : "+Trend"}
                </Btn>
                <Btn variant="ghost" onClick={() => toggle(a.id, "featured", !a.isFeatured)}>
                  {a.isFeatured ? "−Feat" : "+Feat"}
                </Btn>
              </div>
            </Td>
            <Td>
              <Btn variant="danger" onClick={() => setConfirm({ id: a.id, title: a.title })}>Delete</Btn>
            </Td>
          </Tr>
        ))}
      </Table>
      {confirm && (
        <ConfirmModal
          message={`Delete article "${confirm.title}"?`}
          onConfirm={() => del(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

/* ── Posts ───────────────────────────────────────────────────────────────── */

function RemoveModal({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-md mx-4"
      >
        <h3 className="text-white font-bold mb-3">Remove {label}</h3>
        <label className="text-xs text-slate-400 mb-1 block">Reason (required)</label>
        <Input value={reason} onChange={setReason} placeholder="Reason for removal…" className="w-full mb-4" />
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={() => onConfirm(reason)} disabled={!reason.trim()}>Remove</Btn>
        </div>
      </motion.div>
    </div>
  );
}

function Posts({ token }: { token: string }) {
  const [data, setData] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [removeId, setRemoveId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<AdminPost[]>("GET", "/admin/posts", token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function del(id: number) {
    await api("DELETE", `/admin/posts/${id}`, token);
    setConfirm(null);
    load();
  }

  async function remove(id: number, reason: string) {
    await api("PATCH", `/admin/posts/${id}/remove`, token, { reason });
    setRemoveId(null);
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <SectionTitle>Posts ({data.length})</SectionTitle>
      <Table headers={["ID", "Type", "Content", "Author", "Created", "Actions"]}>
        {data.map((p) => (
          <Tr key={p.id}>
            <Td className="text-slate-500 text-xs">{p.id}</Td>
            <Td><Badge label={p.type} color="bg-slate-800 text-slate-300" /></Td>
            <Td>
              <p className="text-sm max-w-xs truncate">
                {p.title ?? p.content ?? <span className="text-slate-500 italic">No content</span>}
              </p>
            </Td>
            <Td className="text-slate-400 text-xs">{p.authorId}</Td>
            <Td className="text-slate-400 text-xs">{new Date(p.createdAt).toLocaleDateString()}</Td>
            <Td>
              <div className="flex gap-1">
                <Btn variant="warning" onClick={() => setRemoveId(p.id)}>Remove</Btn>
                <Btn variant="danger" onClick={() => setConfirm(p.id)}>Delete</Btn>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
      {confirm !== null && (
        <ConfirmModal
          message="Permanently delete this post?"
          onConfirm={() => del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {removeId !== null && (
        <RemoveModal
          label="Post"
          onConfirm={(reason) => remove(removeId, reason)}
          onCancel={() => setRemoveId(null)}
        />
      )}
    </div>
  );
}

/* ── Communities ─────────────────────────────────────────────────────────── */

function Communities({ token }: { token: string }) {
  const [data, setData] = useState<AdminCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<AdminCommunity[]>("GET", "/admin/communities", token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function del(id: number) {
    await api("DELETE", `/admin/communities/${id}`, token);
    setConfirm(null);
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <SectionTitle>Communities ({data.length})</SectionTitle>
      <Table headers={["ID", "Name", "Members", "Posts", "Type", "Status", "Actions"]}>
        {data.map((c) => (
          <Tr key={c.id}>
            <Td className="text-slate-500 text-xs">{c.id}</Td>
            <Td>
              <span className="mr-2">{c.emoji}</span>
              <span className="font-medium">{c.name}</span>
            </Td>
            <Td className="text-center">{c.memberCount}</Td>
            <Td className="text-center">{c.totalPosts}</Td>
            <Td><Badge label={c.isPrivate ? "Private" : "Public"} color={c.isPrivate ? "bg-slate-800 text-slate-400" : "bg-blue-900/40 text-blue-300"} /></Td>
            <Td><Badge label={c.isLive ? "Live" : "Draft"} color={c.isLive ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-500"} /></Td>
            <Td>
              <Btn variant="danger" onClick={() => setConfirm({ id: c.id, name: c.name })}>Delete</Btn>
            </Td>
          </Tr>
        ))}
      </Table>
      {confirm && (
        <ConfirmModal
          message={`Delete community "${confirm.name}"?`}
          onConfirm={() => del(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

/* ── Users ───────────────────────────────────────────────────────────────── */

function UserDetailModal({
  userId,
  token,
  onClose,
}: {
  userId: number;
  token: string;
  onClose: () => void;
}) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AdminUserDetail>("GET", `/admin/users/${userId}`, token)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg">User Detail</h3>
          <Btn variant="ghost" onClick={onClose}>✕ Close</Btn>
        </div>
        {loading && <LoadingSpinner />}
        {user && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Name", user.name],
                ["Title", user.title],
                ["Rep Score", user.reputationScore],
                ["Streak Days", user.streakDays],
                ["Followers", user.followers],
                ["Following", user.following],
                ["Debates Joined", user.debatesJoined],
                ["Articles", user.articlesPublished],
              ].map(([k, v]) => (
                <div key={String(k)} className="bg-[#0a0f1a] rounded-lg p-3">
                  <p className="text-slate-500 text-xs">{k}</p>
                  <p className="text-white text-sm font-medium mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            {user.bio && (
              <div className="bg-[#0a0f1a] rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Bio</p>
                <p className="text-slate-300 text-sm">{user.bio}</p>
              </div>
            )}
            <div>
              <p className="text-slate-400 text-xs font-medium mb-2">Recent Rep Events</p>
              {user.repHistory.length === 0 ? (
                <p className="text-slate-500 text-xs italic">No events</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {user.repHistory.map((e) => (
                    <div key={e.id} className="flex justify-between items-center bg-[#0a0f1a] rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-slate-300">{e.description}</p>
                        <p className="text-xs text-slate-500">{e.eventType}</p>
                      </div>
                      <span className={`text-xs font-bold ${e.points >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {e.points >= 0 ? "+" : ""}{e.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Users({ token }: { token: string }) {
  const [data, setData] = useState<{ users: AdminUser[]; total: number; page: number; pageSize: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<{ users: AdminUser[]; total: number; page: number; pageSize: number }>(
      "GET", `/admin/users?page=${page}`, token
    ).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [token, page]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div>
      <SectionTitle>Users ({data.total})</SectionTitle>
      <Table headers={["ID", "Name", "Title", "Rep Score", "Verified", "Joined", "Actions"]}>
        {data.users.map((u) => (
          <Tr key={u.id}>
            <Td className="text-slate-500 text-xs">{u.id}</Td>
            <Td className="font-medium">{u.name}</Td>
            <Td className="text-slate-400 text-xs">{u.title}</Td>
            <Td><span className="text-amber-400 font-medium">{u.reputationScore}</span></Td>
            <Td>{u.isVerified ? <Badge label="Verified" color="bg-blue-900/40 text-blue-300" /> : <span className="text-slate-600 text-xs">—</span>}</Td>
            <Td className="text-slate-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</Td>
            <Td>
              <Btn variant="ghost" onClick={() => setSelectedUser(u.id)}>View</Btn>
            </Td>
          </Tr>
        ))}
      </Table>
      {totalPages > 1 && (
        <div className="flex gap-2 mt-4 items-center justify-center">
          <Btn variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Prev</Btn>
          <span className="text-slate-400 text-sm">Page {page} / {totalPages}</span>
          <Btn variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</Btn>
        </div>
      )}
      {selectedUser !== null && (
        <UserDetailModal userId={selectedUser} token={token} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}

/* ── Reports ─────────────────────────────────────────────────────────────── */

function Reports({ token }: { token: string }) {
  const [data, setData] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ id: number; action: "delete" | "dismiss" } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<AdminReport[]>("GET", "/admin/reports", token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleAction() {
    if (!confirm) return;
    if (confirm.action === "delete") {
      await api("DELETE", `/admin/reports/posts/${confirm.id}`, token);
    } else {
      await api("PATCH", `/admin/reports/posts/${confirm.id}/dismiss`, token);
    }
    setConfirm(null);
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <SectionTitle>Reports ({data.length})</SectionTitle>
      <Table headers={["ID", "Post Content", "Reason", "Report Count", "Flagged", "Date", "Actions"]}>
        {data.map((r) => (
          <Tr key={r.id}>
            <Td className="text-slate-500 text-xs">{r.id}</Td>
            <Td>
              <p className="text-sm max-w-xs truncate text-slate-300">
                {r.postTitle ?? r.postContent ?? <span className="italic text-slate-500">Deleted</span>}
              </p>
              <p className="text-xs text-slate-500">Post #{r.postId}</p>
            </Td>
            <Td><span className="text-slate-300 text-xs">{r.reason ?? "—"}</span></Td>
            <Td className="text-center">
              <span className={`font-bold ${r.reportCount >= 5 ? "text-red-400" : "text-slate-300"}`}>{r.reportCount}</span>
            </Td>
            <Td>{r.isFlagged ? <Badge label="Flagged" color="bg-red-900/40 text-red-400" /> : <span className="text-slate-600 text-xs">—</span>}</Td>
            <Td className="text-slate-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</Td>
            <Td>
              <div className="flex gap-1">
                <Btn variant="ghost" onClick={() => setConfirm({ id: r.postId, action: "dismiss" })}>Dismiss</Btn>
                <Btn variant="danger" onClick={() => setConfirm({ id: r.postId, action: "delete" })}>Delete Post</Btn>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
      {confirm && (
        <ConfirmModal
          message={confirm.action === "delete"
            ? "Delete this post and all its reports?"
            : "Dismiss all reports for this post?"}
          onConfirm={handleAction}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

/* ── Comments ────────────────────────────────────────────────────────────── */

function FlagModal({
  comment,
  token,
  onClose,
  onDone,
}: {
  comment: AdminComment;
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [flagLabel, setFlagLabel] = useState(comment.flagLabel ?? "");
  const [saving, setSaving] = useState(false);
  const isFlagged = comment.isFlagged;

  async function submit() {
    setSaving(true);
    await api("PATCH", `/admin/comments/${comment.id}/flag`, token, {
      isFlagged: !isFlagged,
      flagLabel: !isFlagged ? flagLabel || null : null,
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-md mx-4"
      >
        <h3 className="text-white font-bold mb-3">{isFlagged ? "Unflag" : "Flag"} Comment</h3>
        {!isFlagged && (
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-1 block">Flag Label (optional)</label>
            <Input value={flagLabel} onChange={setFlagLabel} placeholder="e.g. spam, harassment…" className="w-full" />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant={isFlagged ? "success" : "warning"} onClick={submit} disabled={saving}>
            {saving ? "…" : isFlagged ? "Unflag" : "Flag"}
          </Btn>
        </div>
      </motion.div>
    </div>
  );
}

function Comments({ token }: { token: string }) {
  const [data, setData] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [flagComment, setFlagComment] = useState<AdminComment | null>(null);
  const [removeId, setRemoveId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<AdminComment[]>("GET", "/admin/comments", token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function del(id: number) {
    await api("DELETE", `/admin/comments/${id}`, token);
    setConfirm(null);
    load();
  }

  async function remove(id: number, reason: string) {
    await api("PATCH", `/admin/comments/${id}/remove`, token, { reason });
    setRemoveId(null);
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <SectionTitle>Comments ({data.length})</SectionTitle>
      <Table headers={["ID", "Author", "Content", "Context", "Flags", "Actions"]}>
        {data.map((c) => (
          <Tr key={c.id}>
            <Td className="text-slate-500 text-xs">{c.id}</Td>
            <Td className="text-sm font-medium">{c.authorName}</Td>
            <Td>
              <p className="text-sm max-w-xs truncate text-slate-300">{c.content}</p>
            </Td>
            <Td className="text-xs text-slate-500">
              {c.debateId ? `Debate #${c.debateId}` : c.postId ? `Post #${c.postId}` : "—"}
            </Td>
            <Td>
              {c.isFlagged ? <Badge label={c.flagLabel ?? "Flagged"} color="bg-red-900/40 text-red-400" /> : <span className="text-slate-600 text-xs">—</span>}
            </Td>
            <Td>
              <div className="flex gap-1">
                <Btn variant="ghost" onClick={() => setFlagComment(c)}>{c.isFlagged ? "Unflag" : "Flag"}</Btn>
                <Btn variant="warning" onClick={() => setRemoveId(c.id)}>Remove</Btn>
                <Btn variant="danger" onClick={() => setConfirm(c.id)}>Delete</Btn>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
      {confirm !== null && (
        <ConfirmModal message="Permanently delete this comment?" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />
      )}
      {flagComment && (
        <FlagModal
          comment={flagComment}
          token={token}
          onClose={() => setFlagComment(null)}
          onDone={() => { setFlagComment(null); load(); }}
        />
      )}
      {removeId !== null && (
        <RemoveModal label="Comment" onConfirm={(r) => remove(removeId, r)} onCancel={() => setRemoveId(null)} />
      )}
    </div>
  );
}

/* ── Topics ──────────────────────────────────────────────────────────────── */

function TopicForm({
  initial,
  onSave,
  onCancel,
  token,
}: {
  initial?: AdminTopic;
  onSave: () => void;
  onCancel: () => void;
  token: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      if (initial) {
        await api("PATCH", `/admin/topics/${initial.id}`, token, { name, color, slug, icon, description });
      } else {
        await api("POST", "/admin/topics", token, { name, color, slug, icon, description });
      }
      onSave();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-md mx-4"
      >
        <h3 className="text-white font-bold mb-4">{initial ? "Edit Topic" : "New Topic"}</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 mb-1 block">Name *</label><Input value={name} onChange={setName} placeholder="Topic name" className="w-full" /></div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="text-xs text-slate-400 mb-1 block">Color</label><Input value={color} onChange={setColor} type="color" className="w-full h-9 p-0.5" /></div>
            <div className="flex-1"><label className="text-xs text-slate-400 mb-1 block">Slug</label><Input value={slug} onChange={setSlug} placeholder="topic-slug" className="w-full" /></div>
          </div>
          <div><label className="text-xs text-slate-400 mb-1 block">Icon (emoji)</label><Input value={icon} onChange={setIcon} placeholder="🔬" className="w-full" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Description</label><Textarea value={description} onChange={setDescription} placeholder="Short description…" rows={2} /></div>
          {error && <ErrorMsg msg={error} />}
          <div className="flex gap-3 justify-end">
            <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
            <Btn onClick={submit} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save"}</Btn>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Topics({ token }: { token: string }) {
  const [data, setData] = useState<AdminTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTopic, setEditTopic] = useState<AdminTopic | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<AdminTopic[]>("GET", "/admin/topics", token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function del(id: number) {
    await api("DELETE", `/admin/topics/${id}`, token);
    setConfirm(null);
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <SectionTitle>Topics ({data.length})</SectionTitle>
        <Btn onClick={() => setShowForm(true)}>+ New Topic</Btn>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((t) => (
          <Card key={t.id} className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {t.icon && <span>{t.icon}</span>}
                <span
                  className="text-sm font-bold"
                  style={{ color: t.color }}
                >
                  {t.name}
                </span>
              </div>
              {t.slug && <p className="text-xs text-slate-500">/{t.slug}</p>}
              {t.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.description}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Btn variant="ghost" onClick={() => setEditTopic(t)}>Edit</Btn>
              <Btn variant="danger" onClick={() => setConfirm({ id: t.id, name: t.name })}>Del</Btn>
            </div>
          </Card>
        ))}
      </div>
      {(showForm || editTopic) && (
        <TopicForm
          initial={editTopic ?? undefined}
          token={token}
          onSave={() => { setShowForm(false); setEditTopic(null); load(); }}
          onCancel={() => { setShowForm(false); setEditTopic(null); }}
        />
      )}
      {confirm && (
        <ConfirmModal
          message={`Delete topic "${confirm.name}"?`}
          onConfirm={() => del(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

/* ── Daily Question ──────────────────────────────────────────────────────── */

function DailyQuestion({ token }: { token: string }) {
  const [current, setCurrent] = useState<DailyQuestion | null>(null);
  const [votes, setVotes] = useState<{ supportCount: number; againstCount: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [newQ, setNewQ] = useState("");
  const [newImg, setNewImg] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api<DailyQuestion>("GET", "/admin/daily-question", token),
      api<{ supportCount: number; againstCount: number; total: number }>("GET", "/admin/daily-question/votes", token),
    ]).then(([qRes, vRes]) => {
      if (qRes.status === "fulfilled") setCurrent(qRes.value);
      if (vRes.status === "fulfilled") setVotes(vRes.value);
    }).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function post() {
    if (!newQ.trim()) return;
    setPosting(true);
    setError("");
    setSuccess("");
    try {
      await api("POST", "/admin/daily-question", token, { question: newQ.trim(), imageUrl: newImg.trim() || undefined });
      setNewQ("");
      setNewImg("");
      setSuccess("Daily question updated!");
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <SectionTitle>Daily Question</SectionTitle>
      {current ? (
        <Card>
          <p className="text-xs text-slate-500 mb-1">Current live question</p>
          <p className="text-white font-semibold text-base mb-3">{current.question}</p>
          {votes && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-green-400 font-bold">{votes.supportCount}</span>
                <span className="text-slate-400 ml-1">support ({current.supportPercent}%)</span>
              </div>
              <div>
                <span className="text-red-400 font-bold">{votes.againstCount}</span>
                <span className="text-slate-400 ml-1">against ({current.againstPercent}%)</span>
              </div>
              <div>
                <span className="text-slate-300 font-bold">{votes.total}</span>
                <span className="text-slate-400 ml-1">total votes</span>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card><p className="text-slate-400 italic text-sm">No active daily question.</p></Card>
      )}

      <Card>
        <h3 className="text-white font-semibold mb-3">Set New Daily Question</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Question *</label>
            <Textarea value={newQ} onChange={setNewQ} placeholder="Ask the community something thought-provoking…" rows={3} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Image URL (optional)</label>
            <Input value={newImg} onChange={setNewImg} placeholder="https://…" className="w-full" />
          </div>
          {error && <ErrorMsg msg={error} />}
          {success && <div className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-sm">{success}</div>}
          <Btn onClick={post} disabled={posting || !newQ.trim()}>{posting ? "Posting…" : "Publish Question"}</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ── Weekly Challenge ────────────────────────────────────────────────────── */

function WeeklyChallenge({ token }: { token: string }) {
  const [current, setCurrent] = useState<WeeklyChallenge | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQ, setNewQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settingWinner, setSettingWinner] = useState<Submission | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<{ challenge: WeeklyChallenge | null; submissions: Submission[] }>("GET", "/admin/weekly-challenge/submissions", token)
      .then((d) => { setCurrent(d.challenge); setSubmissions(d.submissions); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function post() {
    setPosting(true);
    setError("");
    setSuccess("");
    try {
      await api("POST", "/admin/weekly-challenge", token, { question: newQ.trim(), startDate, endDate });
      setNewQ(""); setStartDate(""); setEndDate("");
      setSuccess("Weekly challenge created!");
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setPosting(false);
    }
  }

  async function setWinner(sub: Submission) {
    if (!current) return;
    await api("POST", `/admin/weekly-challenge/${current.id}/winner`, token, {
      submissionId: sub.id,
      userId: sub.userId,
      userName: sub.userName,
      userAvatar: sub.userAvatar,
      response: sub.response,
    });
    setSettingWinner(null);
    load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <SectionTitle>Weekly Challenge</SectionTitle>
      {current ? (
        <Card>
          <p className="text-xs text-slate-500 mb-1">Active challenge</p>
          <p className="text-white font-semibold">{current.question}</p>
          <p className="text-slate-400 text-xs mt-1">
            {new Date(current.startDate).toLocaleDateString()} – {new Date(current.endDate).toLocaleDateString()}
          </p>
          {current.winnerName && (
            <div className="mt-3 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2">
              <p className="text-amber-400 text-sm font-semibold">🏆 Winner: {current.winnerName}</p>
              {current.winnerResponse && <p className="text-slate-300 text-xs mt-1 line-clamp-2">{current.winnerResponse}</p>}
            </div>
          )}
          {!current.winnerName && submissions.length > 0 && (
            <div className="mt-4">
              <p className="text-slate-400 text-xs font-medium mb-2">Submissions ({submissions.length})</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {submissions.map((s) => (
                  <div key={s.id} className="bg-[#0a0f1a] rounded-lg px-3 py-2 flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{s.userName}</p>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{s.response}</p>
                    </div>
                    <Btn variant="success" onClick={() => setSettingWinner(s)}>Pick Winner</Btn>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card><p className="text-slate-400 italic text-sm">No active weekly challenge.</p></Card>
      )}

      <Card>
        <h3 className="text-white font-semibold mb-3">Create New Challenge</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Question *</label>
            <Textarea value={newQ} onChange={setNewQ} placeholder="Pose an intellectual challenge…" rows={3} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Start Date</label>
              <Input value={startDate} onChange={setStartDate} type="date" className="w-full" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">End Date</label>
              <Input value={endDate} onChange={setEndDate} type="date" className="w-full" />
            </div>
          </div>
          {error && <ErrorMsg msg={error} />}
          {success && <div className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-sm">{success}</div>}
          <Btn onClick={post} disabled={posting || !newQ.trim() || !startDate || !endDate}>{posting ? "Creating…" : "Create Challenge"}</Btn>
        </div>
      </Card>

      {settingWinner && (
        <ConfirmModal
          message={`Set "${settingWinner.userName}" as the winner?`}
          onConfirm={() => setWinner(settingWinner)}
          onCancel={() => setSettingWinner(null)}
        />
      )}
    </div>
  );
}

/* ── Review Requests ─────────────────────────────────────────────────────── */

function ReviewRequests({ token }: { token: string }) {
  const [data, setData] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionModal, setActionModal] = useState<ReviewRequest | null>(null);
  const [note, setNote] = useState("");
  const [actionStatus, setActionStatus] = useState<"approved" | "rejected">("approved");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const q = statusFilter ? `?status=${statusFilter}` : "";
    api<ReviewRequest[]>("GET", `/admin/review-requests${q}`, token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function action() {
    if (!actionModal) return;
    setSaving(true);
    await api("PATCH", `/admin/review-requests/${actionModal.id}`, token, {
      status: actionStatus,
      reviewerNote: note || undefined,
    });
    setSaving(false);
    setActionModal(null);
    setNote("");
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <SectionTitle>Review Requests ({data.length})</SectionTitle>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0d1524] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <Table headers={["ID", "Article", "Requester", "Status", "Note", "Date", "Actions"]}>
        {data.map((r) => (
          <Tr key={r.id}>
            <Td className="text-slate-500 text-xs">{r.id}</Td>
            <Td>
              <p className="font-medium text-sm max-w-xs truncate">{r.articleTitle}</p>
              <p className="text-xs text-slate-500">#{r.articleId}</p>
            </Td>
            <Td className="text-sm">{r.requesterName}</Td>
            <Td>
              <Badge
                label={r.status}
                color={r.status === "approved" ? "bg-emerald-900/40 text-emerald-400" : r.status === "rejected" ? "bg-red-900/40 text-red-400" : "bg-amber-900/40 text-amber-400"}
              />
            </Td>
            <Td className="text-xs text-slate-400 max-w-xs truncate">{r.reviewerNote ?? "—"}</Td>
            <Td className="text-slate-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</Td>
            <Td>
              {r.status === "pending" && (
                <div className="flex gap-1">
                  <Btn variant="success" onClick={() => { setActionModal(r); setActionStatus("approved"); }}>Approve</Btn>
                  <Btn variant="danger" onClick={() => { setActionModal(r); setActionStatus("rejected"); }}>Reject</Btn>
                </div>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-md mx-4"
          >
            <h3 className="text-white font-bold mb-1 capitalize">{actionStatus} Review Request</h3>
            <p className="text-slate-400 text-xs mb-4">{actionModal.articleTitle}</p>
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Reviewer Note (optional)</label>
              <Textarea value={note} onChange={setNote} placeholder="Leave a note for the author…" rows={3} />
            </div>
            <div className="flex gap-3 justify-end">
              <Btn variant="ghost" onClick={() => { setActionModal(null); setNote(""); }}>Cancel</Btn>
              <Btn variant={actionStatus === "approved" ? "success" : "danger"} onClick={action} disabled={saving}>
                {saving ? "…" : actionStatus === "approved" ? "Approve" : "Reject"}
              </Btn>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ── Appeals ─────────────────────────────────────────────────────────────── */

function Appeals({ token }: { token: string }) {
  const [data, setData] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionModal, setActionModal] = useState<{ appeal: Appeal; status: "approved" | "denied" } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const q = statusFilter ? `?status=${statusFilter}` : "";
    api<Appeal[]>("GET", `/admin/appeals${q}`, token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function action() {
    if (!actionModal) return;
    setSaving(true);
    await api("PATCH", `/admin/appeals/${actionModal.appeal.id}`, token, {
      status: actionModal.status,
      reviewNote: note || undefined,
    });
    setSaving(false);
    setActionModal(null);
    setNote("");
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <SectionTitle>Content Appeals ({data.length})</SectionTitle>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0d1524] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
        </select>
      </div>
      <Table headers={["ID", "Content", "Reason", "Status", "Review Note", "Date", "Actions"]}>
        {data.map((a) => (
          <Tr key={a.id}>
            <Td className="text-slate-500 text-xs">{a.id}</Td>
            <Td>
              <Badge label={a.contentType} color="bg-slate-800 text-slate-300" />
              <span className="text-xs text-slate-500 ml-2">#{a.contentId}</span>
            </Td>
            <Td><p className="text-sm text-slate-300 max-w-xs truncate">{a.reason}</p></Td>
            <Td>
              <Badge
                label={a.status}
                color={a.status === "approved" ? "bg-emerald-900/40 text-emerald-400" : a.status === "denied" ? "bg-red-900/40 text-red-400" : "bg-blue-900/40 text-blue-400"}
              />
            </Td>
            <Td className="text-xs text-slate-400 max-w-xs truncate">{a.reviewNote ?? "—"}</Td>
            <Td className="text-slate-400 text-xs">{new Date(a.createdAt).toLocaleDateString()}</Td>
            <Td>
              {a.status === "open" && (
                <div className="flex gap-1">
                  <Btn variant="success" onClick={() => { setActionModal({ appeal: a, status: "approved" }); }}>Approve</Btn>
                  <Btn variant="danger" onClick={() => { setActionModal({ appeal: a, status: "denied" }); }}>Deny</Btn>
                </div>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0d1524] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-md mx-4"
          >
            <h3 className="text-white font-bold mb-1 capitalize">{actionModal.status} Appeal</h3>
            <p className="text-slate-400 text-xs mb-4">
              {actionModal.appeal.contentType} #{actionModal.appeal.contentId}
            </p>
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Review Note (optional)</label>
              <Textarea value={note} onChange={setNote} placeholder="Leave a note about this decision…" rows={3} />
            </div>
            <div className="flex gap-3 justify-end">
              <Btn variant="ghost" onClick={() => { setActionModal(null); setNote(""); }}>Cancel</Btn>
              <Btn variant={actionModal.status === "approved" ? "success" : "danger"} onClick={action} disabled={saving}>
                {saving ? "…" : actionModal.status === "approved" ? "Approve" : "Deny"}
              </Btn>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ── Math Flags ──────────────────────────────────────────────────────────── */

function MathFlags({ token }: { token: string }) {
  const [data, setData] = useState<MathFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState<{ id: number; status: "resolved" | "dismissed" } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<MathFlag[]>("GET", "/admin/math-flags", token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function resolve(id: number, status: "resolved" | "dismissed") {
    await api("PUT", `/admin/math-flags/${id}/resolve`, token, { status, resolvedBy: "admin" });
    setResolving(null);
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <SectionTitle>Math Flags ({data.length})</SectionTitle>
      <Table headers={["ID", "Target", "Reason", "Reporter", "Status", "Date", "Actions"]}>
        {data.map((f) => (
          <Tr key={f.id}>
            <Td className="text-slate-500 text-xs">{f.id}</Td>
            <Td>
              <Badge label={f.targetType} color="bg-slate-800 text-slate-300" />
              <span className="text-xs text-slate-500 ml-2">#{f.targetId}</span>
            </Td>
            <Td><p className="text-sm text-slate-300 max-w-xs truncate">{f.reason}</p></Td>
            <Td className="text-xs text-slate-400">{f.reporterUserId}</Td>
            <Td>
              <Badge
                label={f.status}
                color={f.status === "resolved" ? "bg-emerald-900/40 text-emerald-400" : f.status === "dismissed" ? "bg-slate-800 text-slate-400" : "bg-amber-900/40 text-amber-400"}
              />
            </Td>
            <Td className="text-slate-400 text-xs">{new Date(f.createdAt).toLocaleDateString()}</Td>
            <Td>
              {f.status === "pending" && (
                <div className="flex gap-1">
                  <Btn variant="success" onClick={() => setResolving({ id: f.id, status: "resolved" })}>Resolve</Btn>
                  <Btn variant="ghost" onClick={() => setResolving({ id: f.id, status: "dismissed" })}>Dismiss</Btn>
                </div>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
      {resolving && (
        <ConfirmModal
          message={`Mark this flag as "${resolving.status}"?`}
          onConfirm={() => resolve(resolving.id, resolving.status)}
          onCancel={() => setResolving(null)}
        />
      )}
    </div>
  );
}

/* ── Audit Log ───────────────────────────────────────────────────────────── */

function AuditLog({ token }: { token: string }) {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback((off: number) => {
    setLoading(true);
    api<AuditEntry[]>("GET", `/admin/audit-log?limit=50&offset=${off}`, token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(offset); }, [load, offset]);

  const actionColors: Record<string, string> = {
    freeze_debate: "bg-blue-900/40 text-blue-300",
    unfreeze_debate: "bg-cyan-900/40 text-cyan-300",
    remove_comment: "bg-red-900/40 text-red-400",
    remove_post: "bg-red-900/40 text-red-400",
    approve_appeal: "bg-emerald-900/40 text-emerald-400",
    deny_appeal: "bg-orange-900/40 text-orange-400",
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <SectionTitle>Moderation Audit Log</SectionTitle>
      <Table headers={["ID", "Action", "Target", "Reason", "Admin", "Date"]}>
        {data.map((e) => (
          <Tr key={e.id}>
            <Td className="text-slate-500 text-xs">{e.id}</Td>
            <Td>
              <Badge
                label={e.action}
                color={actionColors[e.action] ?? "bg-slate-800 text-slate-300"}
              />
            </Td>
            <Td>
              <span className="text-slate-400 text-xs">{e.targetType} #{e.targetId}</span>
            </Td>
            <Td><p className="text-xs text-slate-300 max-w-xs truncate">{e.reason ?? "—"}</p></Td>
            <Td className="text-xs text-slate-500">{e.adminIdentifier ?? "system"}</Td>
            <Td className="text-slate-400 text-xs">{new Date(e.createdAt).toLocaleString()}</Td>
          </Tr>
        ))}
      </Table>
      <div className="flex gap-2 mt-4 items-center justify-center">
        <Btn variant="ghost" onClick={() => setOffset((o) => Math.max(0, o - 50))} disabled={offset === 0}>← Prev 50</Btn>
        <span className="text-slate-400 text-sm">Offset {offset}</span>
        <Btn variant="ghost" onClick={() => setOffset((o) => o + 50)} disabled={data.length < 50}>Next 50 →</Btn>
      </div>
    </div>
  );
}

/* ══ MAIN ADMIN PANEL ════════════════════════════════════════════════════════ */

function AdminPanel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [section, setSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sectionComponent = {
    overview: <Overview token={token} />,
    debates: <Debates token={token} />,
    articles: <Articles token={token} />,
    posts: <Posts token={token} />,
    communities: <Communities token={token} />,
    users: <Users token={token} />,
    reports: <Reports token={token} />,
    comments: <Comments token={token} />,
    topics: <Topics token={token} />,
    "daily-question": <DailyQuestion token={token} />,
    "weekly-challenge": <WeeklyChallenge token={token} />,
    "review-requests": <ReviewRequests token={token} />,
    appeals: <Appeals token={token} />,
    "math-flags": <MathFlags token={token} />,
    "audit-log": <AuditLog token={token} />,
  }[section] ?? <Overview token={token} />;

  return (
    <div className="min-h-screen bg-[#060810] flex text-white">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 h-screen z-40 lg:z-auto w-64 bg-[#080d17] border-r border-[#1e2d45] flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#1e2d45]">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">🛡️</span>
            <span className="font-bold text-white">Treffin Admin</span>
          </div>
          <p className="text-xs text-slate-500">Control Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSection(s.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left
                ${section === s.id
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:bg-[#1e2d45]/40 hover:text-white"}`}
            >
              <span className="text-base leading-none">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-[#1e2d45]">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile) */}
        <div className="lg:hidden sticky top-0 z-20 bg-[#080d17]/90 backdrop-blur-sm border-b border-[#1e2d45] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ☰
          </button>
          <span className="font-semibold text-white">
            {NAV_SECTIONS.find((s) => s.id === section)?.icon}{" "}
            {NAV_SECTIONS.find((s) => s.id === section)?.label}
          </span>
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {sectionComponent}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/* ══ EXPORTED PAGE ═══════════════════════════════════════════════════════════ */

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("treffin_admin_token"));

  function handleLogout() {
    localStorage.removeItem("treffin_admin_token");
    setToken(null);
  }

  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  return <AdminPanel token={token} onLogout={handleLogout} />;
}
