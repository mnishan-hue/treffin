export const ELITE_THRESHOLD_SETTING_KEY = "elite_thinker_threshold";
export const DEFAULT_ELITE_THRESHOLD = 1000;
export const MIN_ELITE_THRESHOLD = 1;
export const MAX_ELITE_THRESHOLD = 1_000_000;

/** Strictly parse the admin-configurable threshold without truncating decimals. */
export function parseEliteThreshold(value: unknown): number | null {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;

  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < MIN_ELITE_THRESHOLD || parsed > MAX_ELITE_THRESHOLD) {
    return null;
  }
  return parsed;
}

export function titleForReputation(score: number, eliteThreshold: number): string {
  if (score >= eliteThreshold) return "Elite Thinker";
  if (score >= Math.floor(eliteThreshold * 0.6)) return "Intellectual";
  if (score >= Math.floor(eliteThreshold * 0.3)) return "Scholar";
  if (score >= Math.floor(eliteThreshold * 0.1)) return "Thinker";
  return "Novice";
}