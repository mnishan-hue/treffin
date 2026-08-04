import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface WeeklyChallenge {
  id: number;
  question: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  winnerUserId: string | null;
  winnerName: string | null;
  winnerAvatar: string | null;
  winnerResponse: string | null;
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

export default function WeeklyChallenge() {
  const [current, setCurrent] = useState<WeeklyChallenge | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [awardingId, setAwardingId] = useState<number | null>(null);
  const [awardSuccess, setAwardSuccess] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  useEffect(() => {
    setStartDate(today);
    setEndDate(nextWeek);
  }, []);

  const load = () => {
    setLoading(true);
    api.get<WeeklyChallenge>("/admin/weekly-challenge")
      .then(setCurrent)
      .catch(() => setCurrent(null))
      .finally(() => setLoading(false));
  };

  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const data = await api.get<{ challenge: WeeklyChallenge | null; submissions: Submission[] }>("/admin/weekly-challenge/submissions");
      if (data.challenge) setCurrent(data.challenge);
      setSubmissions(data.submissions);
    } catch {
      setSubmissions([]);
    }
    setSubmissionsLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadSubmissions(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !startDate || !endDate) return;
    setSubmitting(true);
    try {
      const result = await api.post<WeeklyChallenge>("/admin/weekly-challenge", {
        question: question.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      setCurrent(result);
      setSubmissions([]);
      setQuestion("");
      setStartDate(today);
      setEndDate(nextWeek);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {}
    setSubmitting(false);
  };

  const handleAwardWinner = async (submission: Submission) => {
    if (!current) return;
    setAwardingId(submission.id);
    try {
      await api.post(`/admin/weekly-challenge/${current.id}/winner`, {
        submissionId: submission.id,
        userId: submission.userId,
        userName: submission.userName,
        userAvatar: submission.userAvatar,
        response: submission.response,
      });
      setCurrent((prev) => prev ? {
        ...prev,
        winnerUserId: submission.userId,
        winnerName: submission.userName,
        winnerAvatar: submission.userAvatar,
        winnerResponse: submission.response,
      } : prev);
      setAwardSuccess(true);
      setTimeout(() => setAwardSuccess(false), 3000);
    } catch {}
    setAwardingId(null);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const isWinner = (submission: Submission) => current?.winnerUserId === submission.userId;

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-foreground mb-4">Weekly Intellectual Challenge</h2>

      {/* Current challenge */}
      {loading ? (
        <div className="text-muted-foreground mb-6">Loading…</div>
      ) : current ? (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="font-medium text-foreground leading-snug">{current.question}</p>
            <span className="shrink-0 text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">Active</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>📅 {formatDate(current.startDate)} — {formatDate(current.endDate)}</span>
          </div>
          {current.winnerName && (
            <div className="mt-3 flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-3">
              <span className="text-lg">🏆</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Winner</p>
                <p className="text-sm font-semibold text-foreground">{current.winnerName}</p>
                {current.winnerResponse && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{current.winnerResponse}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 text-muted-foreground text-sm">No active weekly challenge</div>
      )}

      {/* Submissions */}
      {current && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">
              Submissions
              {submissions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{submissions.length}</span>
              )}
            </h3>
            <button
              onClick={loadSubmissions}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Refresh
            </button>
          </div>

          {awardSuccess && (
            <div className="mb-3 px-4 py-3 bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm rounded-xl">
              🏆 Winner awarded! They've received +150 rep.
            </div>
          )}

          {submissionsLoading ? (
            <div className="text-muted-foreground text-sm py-4 text-center">Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl py-8 text-center text-muted-foreground text-sm">
              No submissions yet
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {submissions.map((s) => {
                const expanded = expandedId === s.id;
                const won = isWinner(s);

                return (
                  <div key={s.id} className={`bg-card border rounded-xl overflow-hidden transition-colors ${won ? "border-amber-500/40" : "border-border"}`}>
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 text-xs font-bold text-primary uppercase">
                            {s.userName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{s.userName}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(s.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {won && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">🏆 Winner</span>
                          )}
                          {!current.winnerUserId && (
                            <button
                              disabled={awardingId === s.id}
                              onClick={() => handleAwardWinner(s)}
                              className="text-xs px-3 py-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 transition-colors disabled:opacity-50 font-medium"
                            >
                              {awardingId === s.id ? "Awarding…" : "Award Winner"}
                            </button>
                          )}
                        </div>
                      </div>

                      <p className={`text-sm text-foreground leading-relaxed ${!expanded ? "line-clamp-3" : ""}`}>
                        {s.response}
                      </p>

                      {s.response.length > 180 && (
                        <button
                          onClick={() => setExpandedId(expanded ? null : s.id)}
                          className="mt-1.5 text-xs text-primary hover:underline"
                        >
                          {expanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Set new challenge form */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Set New Weekly Challenge</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Challenge Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
              placeholder="Write a 500-word argument on whether free will exists in a deterministic universe"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                required
              />
            </div>
          </div>
          {success && (
            <p className="text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              ✅ Weekly challenge activated!
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Activating…" : "Activate Challenge"}
          </button>
        </form>
      </div>
    </div>
  );
}
