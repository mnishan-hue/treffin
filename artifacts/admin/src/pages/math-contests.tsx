import { useState } from "react";
import { api } from "@/lib/api";

interface MathContest {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  startTime: string;
  endTime: string;
  prizeDescription: string | null;
  isActive: boolean;
  totalParticipants: number;
  createdBy: string;
  createdAt: string;
  problemIds: number[];
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface MathProblem {
  id: number;
  title: string;
  difficulty: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  score: number;
  solutionsCount: number;
  joinedAt: string;
  lastSubmittedAt: string | null;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400",
  intermediate: "bg-blue-500/20 text-blue-400",
  advanced: "bg-amber-500/20 text-amber-400",
  olympiad: "bg-red-500/20 text-red-400",
};

function getContestStatus(contest: MathContest): string {
  const now = new Date();
  const start = new Date(contest.startTime);
  const end = new Date(contest.endTime);
  if (!contest.isActive) return "disabled";
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "active";
  return "past";
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  upcoming: "bg-blue-500/20 text-blue-400",
  past: "bg-gray-500/20 text-gray-400",
  disabled: "bg-red-500/20 text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  active: "🟢 Live",
  upcoming: "🔵 Upcoming",
  past: "⚫ Ended",
  disabled: "🔴 Disabled",
};

export default function MathContests() {
  const [contests, setContests] = useState<MathContest[]>([]);
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    difficulty: "intermediate",
    startTime: "",
    endTime: "",
    prizeDescription: "",
  });
  const [selectedProblemIds, setSelectedProblemIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    difficulty: "intermediate",
    startTime: "",
    endTime: "",
    prizeDescription: "",
  });
  const [editSelectedProblemIds, setEditSelectedProblemIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [leaderboardId, setLeaderboardId] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [contestsData, problemsData] = await Promise.all([
        api.get<MathContest[]>("/admin/math-contests"),
        api.get<MathProblem[]>("/math/problems?limit=100"),
      ]);
      setContests(contestsData);
      setProblems(problemsData);
      setLoaded(true);
    } catch {
      setMessage("Failed to load contests.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.startTime || !form.endTime) {
      setMessage("Please fill in all required fields.");
      return;
    }
    setCreating(true);
    setMessage("");
    try {
      const created = await api.post<MathContest>("/admin/math-contests", {
        ...form,
        prizeDescription: form.prizeDescription || null,
        problemIds: selectedProblemIds,
      });
      setContests((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ title: "", description: "", difficulty: "intermediate", startTime: "", endTime: "", prizeDescription: "" });
      setSelectedProblemIds([]);
      setMessage("Contest created successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Failed to create contest.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/math-contests/${id}`);
      setContests((prev) => prev.filter((c) => c.id !== id));
      setMessage("Contest deleted.");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Failed to delete contest.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (contest: MathContest) => {
    setTogglingId(contest.id);
    try {
      const updated = await api.patch<MathContest>(`/admin/math-contests/${contest.id}`, {
        isActive: !contest.isActive,
      });
      setContests((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    } catch {
      setMessage("Failed to update contest status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleStartEdit = (contest: MathContest) => {
    setShowCreate(false);
    setLeaderboardId(null);
    setEditingId(contest.id);
    setEditForm({
      title: contest.title,
      description: contest.description,
      difficulty: contest.difficulty,
      startTime: toDatetimeLocal(contest.startTime),
      endTime: toDatetimeLocal(contest.endTime),
      prizeDescription: contest.prizeDescription ?? "",
    });
    setEditSelectedProblemIds(contest.problemIds ?? []);
    setMessage("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const toggleEditProblem = (id: number) => {
    setEditSelectedProblemIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSaveEdit = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    if (!editForm.title || !editForm.description || !editForm.startTime || !editForm.endTime) {
      setMessage("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const updated = await api.patch<MathContest>(`/admin/math-contests/${id}`, {
        ...editForm,
        prizeDescription: editForm.prizeDescription || null,
        problemIds: editSelectedProblemIds,
      });
      setContests((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
      setMessage("Contest updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Failed to update contest.");
    } finally {
      setSaving(false);
    }
  };

  const toggleProblem = (id: number) => {
    setSelectedProblemIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleToggleLeaderboard = async (contest: MathContest) => {
    if (leaderboardId === contest.id) {
      setLeaderboardId(null);
      return;
    }
    setEditingId(null);
    setLeaderboardId(contest.id);
    setLeaderboard([]);
    setLeaderboardError("");
    setLeaderboardLoading(true);
    try {
      const data = await api.get<LeaderboardEntry[]>(`/admin/math-contests/${contest.id}/leaderboard`);
      setLeaderboard(data);
    } catch {
      setLeaderboardError("Failed to load leaderboard.");
    } finally {
      setLeaderboardLoading(false);
    }
  };

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Math Contests</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Create and manage timed math competitions.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load Contests"}
        </button>
        {message && <p className="text-sm text-red-400">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Math Contests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contests.length} contests total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {showCreate ? "Cancel" : "+ Create Contest"}
          </button>
          <button
            onClick={load}
            className="px-3 py-2 border border-border text-sm rounded-lg hover:bg-accent transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-2.5 rounded-lg text-sm ${message.includes("success") || message.includes("deleted") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          {message}
        </div>
      )}

      {showCreate && (
        <div className="border border-border rounded-xl p-6 bg-card space-y-4">
          <h2 className="font-semibold text-base">Create New Contest</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Spring Olympiad 2026"
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the contest…"
                  rows={3}
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="olympiad">Olympiad</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Prize Description</label>
                <input
                  value={form.prizeDescription}
                  onChange={(e) => setForm((f) => ({ ...f, prizeDescription: e.target.value }))}
                  placeholder="e.g. $100 + Certificate"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Start Time *</label>
                <input
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">End Time *</label>
                <input
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Include Problems ({selectedProblemIds.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {problems.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProblemIds.includes(p.id)}
                      onChange={() => toggleProblem(p.id)}
                      className="rounded"
                    />
                    <span className="text-sm flex-1 truncate">{p.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[p.difficulty] ?? "bg-gray-500/20 text-gray-400"}`}>
                      {p.difficulty}
                    </span>
                  </label>
                ))}
                {problems.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">No problems available</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={creating} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {creating ? "Creating…" : "Create Contest"}
              </button>
            </div>
          </form>
        </div>
      )}

      {contests.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground">No contests yet. Create your first one above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contests.map((contest) => {
            const status = getContestStatus(contest);
            return (
              <div key={contest.id} className="border border-border rounded-xl p-5 bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS.past}`}>
                        {STATUS_LABELS[status] ?? status}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[contest.difficulty] ?? "bg-gray-500/20 text-gray-400"}`}>
                        {contest.difficulty}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base mb-1">{contest.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{contest.description}</p>
                    {contest.prizeDescription && (
                      <p className="text-xs text-amber-400 mb-2">🏆 {contest.prizeDescription}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>👥 {contest.totalParticipants} participants</span>
                      <span>📅 {new Date(contest.startTime).toLocaleDateString()} – {new Date(contest.endTime).toLocaleDateString()}</span>
                      <span>by {contest.createdBy}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="text-right text-xs text-muted-foreground">
                      <div>ID #{contest.id}</div>
                      <div>{new Date(contest.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => editingId === contest.id ? handleCancelEdit() : handleStartEdit(contest)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors border ${
                          editingId === contest.id
                            ? "bg-accent text-foreground border-border"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25"
                        }`}
                      >
                        {editingId === contest.id ? "Cancel" : "Edit"}
                      </button>
                      <button
                        onClick={() => void handleToggleActive(contest)}
                        disabled={togglingId === contest.id}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          contest.isActive
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                        }`}
                      >
                        {togglingId === contest.id ? "…" : contest.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => void handleDelete(contest.id, contest.title)}
                        disabled={deletingId === contest.id}
                        className="text-[11px] px-2.5 py-1 rounded-lg font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                      >
                        {deletingId === contest.id ? "…" : "Delete"}
                      </button>
                      <button
                        onClick={() => void handleToggleLeaderboard(contest)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors border ${
                          leaderboardId === contest.id
                            ? "bg-accent text-foreground border-border"
                            : "bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25"
                        }`}
                      >
                        {leaderboardId === contest.id ? "Hide Leaderboard" : "Leaderboard"}
                      </button>
                    </div>
                  </div>
                </div>

                {leaderboardId === contest.id && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Leaderboard
                    </h4>
                    {leaderboardLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : leaderboardError ? (
                      <p className="text-sm text-red-400">{leaderboardError}</p>
                    ) : leaderboard.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No participants yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground border-b border-border">
                              <th className="py-1.5 pr-3 font-medium">Rank</th>
                              <th className="py-1.5 pr-3 font-medium">User</th>
                              <th className="py-1.5 pr-3 font-medium">Score</th>
                              <th className="py-1.5 pr-3 font-medium">Solutions</th>
                              <th className="py-1.5 pr-3 font-medium">Last Activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaderboard.map((entry) => (
                              <tr key={entry.userId} className="border-b border-border/50 last:border-0">
                                <td className="py-1.5 pr-3 font-medium">
                                  {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                                </td>
                                <td className="py-1.5 pr-3">{entry.userName}</td>
                                <td className="py-1.5 pr-3">{entry.score}</td>
                                <td className="py-1.5 pr-3">{entry.solutionsCount}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground text-xs">
                                  {entry.lastSubmittedAt ? new Date(entry.lastSubmittedAt).toLocaleString() : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {editingId === contest.id && (
                  <form
                    onSubmit={(e) => void handleSaveEdit(e, contest.id)}
                    className="mt-4 pt-4 border-t border-border space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Title *</label>
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                          required
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Description *</label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          rows={3}
                          required
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                        <select
                          value={editForm.difficulty}
                          onChange={(e) => setEditForm((f) => ({ ...f, difficulty: e.target.value }))}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                          <option value="olympiad">Olympiad</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Prize Description</label>
                        <input
                          value={editForm.prizeDescription}
                          onChange={(e) => setEditForm((f) => ({ ...f, prizeDescription: e.target.value }))}
                          placeholder="e.g. $100 + Certificate"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Start Time *</label>
                        <input
                          type="datetime-local"
                          value={editForm.startTime}
                          onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                          required
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">End Time *</label>
                        <input
                          type="datetime-local"
                          value={editForm.endTime}
                          onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                          required
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Problems ({editSelectedProblemIds.length} selected)
                      </label>
                      <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                        {problems.map((p) => (
                          <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editSelectedProblemIds.includes(p.id)}
                              onChange={() => toggleEditProblem(p.id)}
                              className="rounded"
                            />
                            <span className="text-sm flex-1 truncate">{p.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[p.difficulty] ?? "bg-gray-500/20 text-gray-400"}`}>
                              {p.difficulty}
                            </span>
                          </label>
                        ))}
                        {problems.length === 0 && (
                          <div className="px-3 py-4 text-sm text-muted-foreground text-center">No problems available</div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                      <button type="button" onClick={handleCancelEdit} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
