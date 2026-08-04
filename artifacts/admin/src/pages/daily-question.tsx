import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface DailyQuestion {
  id: number;
  question: string;
  supportPercent: number;
  againstPercent: number;
  participantCount: number;
  isActive: boolean;
  imageUrl: string;
}

interface VoteStats {
  question: {
    id: number;
    question: string;
    supportPercent: number;
    againstPercent: number;
    participantCount: number;
  } | null;
  supportCount: number;
  againstCount: number;
  total: number;
}

export default function DailyQuestion() {
  const [current, setCurrent] = useState<DailyQuestion | null>(null);
  const [voteStats, setVoteStats] = useState<VoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [votesLoading, setVotesLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<DailyQuestion>("/admin/daily-question")
      .then(setCurrent)
      .catch(() => setCurrent(null))
      .finally(() => setLoading(false));
  };

  const loadVotes = async () => {
    setVotesLoading(true);
    try {
      const data = await api.get<VoteStats>("/admin/daily-question/votes");
      setVoteStats(data);
    } catch {
      setVoteStats(null);
    }
    setVotesLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadVotes(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setSubmitting(true);
    try {
      const result = await api.post<DailyQuestion>("/admin/daily-question", { question: question.trim(), imageUrl: imageUrl.trim() });
      setCurrent(result);
      setVoteStats(null);
      setQuestion("");
      setImageUrl("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {}
    setSubmitting(false);
  };

  const supportPct = voteStats && voteStats.total > 0 ? Math.round((voteStats.supportCount / voteStats.total) * 100) : 50;
  const againstPct = 100 - supportPct;

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-foreground mb-4">Daily Question</h2>

      {/* Current question */}
      {loading ? (
        <div className="text-muted-foreground mb-6">Loading…</div>
      ) : current ? (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="font-medium text-foreground">{current.question}</p>
            <span className="shrink-0 text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">Active</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>🟢 Support: {current.supportPercent}%</span>
            <span>🔴 Against: {current.againstPercent}%</span>
            <span>👥 {current.participantCount} votes</span>
          </div>
          <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${current.supportPercent}%` }} />
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 text-muted-foreground text-sm">No active daily question</div>
      )}

      {/* Live vote breakdown */}
      {current && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Live Vote Breakdown</h3>
            <button
              onClick={loadVotes}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Refresh
            </button>
          </div>

          {votesLoading ? (
            <div className="text-muted-foreground text-sm py-2 text-center">Loading…</div>
          ) : !voteStats || voteStats.total === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-3">No votes yet</div>
          ) : (
            <div className="space-y-4">
              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Votes</span>
                <span className="text-lg font-bold text-foreground">{voteStats.total}</span>
              </div>

              {/* Support bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="text-indigo-400">👍 Support</span>
                  <span className="text-indigo-400">{voteStats.supportCount} votes ({supportPct}%)</span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${supportPct}%` }}
                  />
                </div>
              </div>

              {/* Against bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="text-rose-400">👎 Against</span>
                  <span className="text-rose-400">{voteStats.againstCount} votes ({againstPct}%)</span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${againstPct}%` }}
                  />
                </div>
              </div>

              {/* Leading side */}
              <div className="flex items-center gap-2 bg-accent/30 rounded-lg px-3 py-2.5">
                <span className="text-sm font-semibold text-foreground">
                  {supportPct > againstPct ? "👍 Support" : supportPct < againstPct ? "👎 Against" : "🤝 Tied"} leading
                </span>
                {supportPct !== againstPct && (
                  <span className="text-xs text-muted-foreground">by {Math.abs(supportPct - againstPct)}%</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Set new question form */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Set New Daily Question</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Question Text</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
              placeholder="Should artificial intelligence be regulated by governments?"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Image URL <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              placeholder="https://…"
            />
          </div>
          {success && (
            <p className="text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              ✅ Daily question activated!
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Activating…" : "Activate Question"}
          </button>
        </form>
      </div>
    </div>
  );
}
