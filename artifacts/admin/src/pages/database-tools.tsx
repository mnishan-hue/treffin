import { useState } from "react";
import { api } from "@/lib/api";

type LogLine = { text: string; type: "info" | "success" | "error" };

interface ActionResult {
  ok: boolean;
  message?: string;
  stdout?: string;
  error?: string;
}

function LogWindow({ lines }: { lines: LogLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-border bg-black/60 p-4 font-mono text-xs leading-relaxed max-h-72 overflow-y-auto space-y-0.5">
      {lines.map((l, i) => (
        <p
          key={i}
          className={
            l.type === "success"
              ? "text-emerald-400"
              : l.type === "error"
              ? "text-red-400"
              : "text-muted-foreground"
          }
        >
          {l.text}
        </p>
      ))}
    </div>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  buttonColor: string;
  danger?: boolean;
  onRun: () => Promise<void>;
  running: boolean;
}

function ActionCard({
  title,
  description,
  buttonLabel,
  buttonColor,
  danger,
  onRun,
  running,
}: ActionCardProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleClick = async () => {
    if (danger && !confirmed) {
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 4000);
      return;
    }
    setConfirmed(false);
    await onRun();
  };

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 ${
        danger ? "border-red-500/25 bg-red-500/5" : "border-border bg-card"
      }`}
    >
      <div>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={handleClick}
        disabled={running}
        className={`self-start px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          confirmed
            ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
            : buttonColor
        }`}
      >
        {running
          ? "Running…"
          : confirmed
          ? "⚠ Click again to confirm"
          : buttonLabel}
      </button>
    </div>
  );
}

export default function DatabaseTools() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const addLog = (text: string, type: LogLine["type"] = "info") =>
    setLogs((prev) => [...prev, { text, type }]);

  const clearAndRun = async (label: string, fn: () => Promise<ActionResult>) => {
    setLogs([]);
    setRunning(label);
    addLog(`▶ Starting: ${label}…`);
    try {
      const result = await fn();
      if (result.stdout) {
        result.stdout
          .split("\n")
          .filter(Boolean)
          .forEach((line) => addLog(`  ${line}`, "info"));
      }
      if (result.ok) {
        addLog(`✅ ${result.message ?? "Done"}`, "success");
      } else {
        addLog(`❌ ${result.error ?? "Unknown error"}`, "error");
      }
    } catch (err) {
      addLog(`❌ ${err instanceof Error ? err.message : "Unexpected error"}`, "error");
    } finally {
      setRunning(null);
    }
  };

  const runSeed = () =>
    clearAndRun("Seed database", () =>
      api.post<ActionResult>("/admin/db/seed", {}),
    );

  const runResetAndSeed = () =>
    clearAndRun("Reset & reseed", () =>
      api.post<ActionResult>("/admin/db/reset-and-seed", {}),
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Database Tools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage sample data for development and testing. These actions run directly against
          the connected database.
        </p>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
        <svg
          className="w-4 h-4 text-amber-400 mt-0.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-xs text-amber-300 leading-relaxed">
          <strong>Development use only.</strong> Seed adds data on top of what exists.
          Reset wipes <em>all</em> content before reseeding — this cannot be undone.
        </p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ActionCard
          title="Seed Database"
          description="Clears all existing data, then inserts 10 users, 8 debates, 6 articles, 5 communities, 7 math problems, 2 contests, a daily question, and a weekly challenge."
          buttonLabel="Run Seed"
          buttonColor="bg-primary/15 text-primary hover:bg-primary/25"
          running={running === "Seed database"}
          onRun={runSeed}
        />
        <ActionCard
          title="Reset & Reseed"
          description="Same as Seed, but requires a double-click to confirm. Use this when you want an extra safety prompt before wiping data."
          buttonLabel="Reset & Reseed"
          buttonColor="bg-red-500/15 text-red-400 hover:bg-red-500/25"
          danger
          running={running === "Reset & reseed"}
          onRun={runResetAndSeed}
        />
      </div>

      {/* DB counts helper */}
      <TableCounts />

      {/* Log output */}
      <LogWindow lines={logs} />
    </div>
  );
}

interface Counts {
  users: number;
  debates: number;
  articles: number;
  communities: number;
  posts: number;
  mathProblems: number;
}

function TableCounts() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await api.get<Counts>("/admin/db/counts");
      setCounts(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const items: { label: string; key: keyof Counts }[] = [
    { label: "Users", key: "users" },
    { label: "Debates", key: "debates" },
    { label: "Articles", key: "articles" },
    { label: "Communities", key: "communities" },
    { label: "Posts", key: "posts" },
    { label: "Math Problems", key: "mathProblems" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">Current Row Counts</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {counts ? (
        <div className="grid grid-cols-3 gap-3">
          {items.map(({ label, key }) => (
            <div key={key} className="rounded-lg bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{counts[key]}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Click <strong>Refresh</strong> to check current row counts.
        </p>
      )}
    </div>
  );
}
