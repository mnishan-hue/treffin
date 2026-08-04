import { DailyQuestion, useVoteDebate } from "@workspace/api-client-react";
import { formatNumber } from "@/lib/utils";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function DailyQuestionCard({ question }: { question: DailyQuestion }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const voteDebate = useVoteDebate();
  const [hasVoted, setHasVoted] = useState(false);
  const [support, setSupport] = useState(question.supportPercent);
  const [against, setAgainst] = useState(question.againstPercent);

  const handleJoin = () => {
    if (hasVoted) {
      setLocation(`/debates/${question.id}`);
      return;
    }
    voteDebate.mutate(
      { id: question.id, data: { vote: "support" } },
      {
        onSuccess: (d) => {
          setHasVoted(true);
          setSupport(d.supportPercent);
          setAgainst(d.againstPercent);
          toast({ title: "Vote cast!", description: "You voted in support." });
        },
      }
    );
  };

  const handleView = () => setLocation(`/debates/${question.id}`);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 shadow-[0_0_40px_rgba(37,99,235,0.12)]" style={{ background: "linear-gradient(135deg, #0d1830 0%, #060c18 60%, #0a0510 100%)" }}>
      {question.imageUrl && (
        <div
          className="absolute right-0 top-0 w-2/5 h-full opacity-40 pointer-events-none"
          style={{ backgroundImage: `url(${question.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center", maskImage: "linear-gradient(to left, rgba(0,0,0,0.8), transparent)" }}
        />
      )}
      <div className="relative z-10 p-6 flex flex-col gap-4 max-w-[65%]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border border-primary/30">
            Daily Big Question
          </span>
          {question.isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live Now
            </span>
          )}
        </div>

        <h2 className="text-xl sm:text-2xl font-bold leading-tight text-white">
          {question.question}
        </h2>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-blue-400">Support {support}%</span>
            <span className="text-red-400">Against {against}%</span>
          </div>
          <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden flex">
            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700" style={{ width: `${support}%` }} />
            <div className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-700" style={{ width: `${against}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {formatNumber(question.participantCount)} Thinkers have voted
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-2 rounded-full text-sm transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(37,99,235,0.6)] hover:-translate-y-0.5"
            onClick={handleJoin}
            disabled={voteDebate.isPending}
            data-testid="button-join-debate"
          >
            {hasVoted ? "Voted — Enter Debate" : "Join Debate"}
          </button>
          <button
            className="bg-white/10 hover:bg-white/15 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors border border-white/20 hover:-translate-y-0.5"
            onClick={handleView}
            data-testid="button-view-debate"
          >
            View Debate
          </button>
        </div>
      </div>
    </div>
  );
}
