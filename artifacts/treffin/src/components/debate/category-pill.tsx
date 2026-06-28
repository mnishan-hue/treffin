import { cn } from "@/lib/utils";

const CATEGORY_STYLES: Record<string, string> = {
  "philosophy":           "bg-violet-500/15 text-violet-300 border-violet-500/25",
  "science":              "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "economics":            "bg-amber-500/15 text-amber-300 border-amber-500/25",
  "politics":             "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "law":                  "bg-blue-500/15 text-blue-300 border-blue-500/25",
  "psychology":           "bg-purple-500/15 text-purple-300 border-purple-500/25",
  "history":              "bg-orange-500/15 text-orange-300 border-orange-500/25",
  "technology":           "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  "artificial intelligence": "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  "education":            "bg-teal-500/15 text-teal-300 border-teal-500/25",
  "social issues":        "bg-pink-500/15 text-pink-300 border-pink-500/25",
  "ethics":               "bg-violet-500/15 text-violet-300 border-violet-500/25",
};

const DEFAULT_STYLE = "bg-primary/10 text-primary border-primary/20";

interface CategoryPillProps {
  category: string;
  className?: string;
}

export function CategoryPill({ category, className }: CategoryPillProps) {
  const key = category.toLowerCase();
  const style = CATEGORY_STYLES[key] ?? DEFAULT_STYLE;
  return (
    <span
      className={cn(
        "inline-flex items-center border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
        style,
        className
      )}
    >
      {category}
    </span>
  );
}
