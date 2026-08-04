import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function getTimeRemaining(endsAt: string): { label: string; urgent: boolean } | null {
  const date = new Date(endsAt);
  if (isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60));
    return { label: `${mins}m left`, urgent: true };
  }
  if (hours < 24) {
    return { label: `${hours}h left`, urgent: true };
  }
  return { label: `${days}d left`, urgent: false };
}

interface CountdownChipProps {
  endsAt: string | null | undefined;
  className?: string;
}

export function CountdownChip({ endsAt, className }: CountdownChipProps) {
  if (!endsAt) return null;

  const remaining = getTimeRemaining(endsAt);
  if (!remaining) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
        remaining.urgent
          ? "bg-red-500/15 text-red-400 border-red-500/25"
          : "bg-muted text-muted-foreground border-border",
        className
      )}
    >
      <Clock className={cn("w-2.5 h-2.5", remaining.urgent && "animate-pulse")} />
      {remaining.label}
    </span>
  );
}
