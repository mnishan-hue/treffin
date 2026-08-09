export function normalizeOrigin(value: string): string | null {
  try { return new URL(value).origin; } catch { return null; }
}

export function collectTrustedOrigins(...values: Array<string | undefined>): string[] {
  const origins = new Set<string>();
  for (const value of values) {
    for (const entry of (value ?? "").split(",")) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const origin = normalizeOrigin(candidate);
      if (origin) origins.add(origin);
    }
  }
  return [...origins];
}
export function resolveTrustedFrontendUrl(candidate: unknown, configured: string, allowed: readonly string[]): string {
  const fallback = normalizeOrigin(configured);
  if (!fallback) throw new Error("Configured frontend URL must be absolute");
  if (typeof candidate !== "string" || !candidate.trim()) return fallback;
  const candidateOrigin = normalizeOrigin(candidate);
  const trusted = new Set(allowed.map(normalizeOrigin).filter((value): value is string => !!value));
  return candidateOrigin && (candidateOrigin === fallback || trusted.has(candidateOrigin)) ? candidateOrigin : fallback;
}

export function destructiveDbToolsEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}

export function debateAcceptsParticipation(debate: { isLive: boolean; isFrozen?: boolean; endedAt?: Date | null }): boolean {
  return debate.isLive && !debate.isFrozen && !debate.endedAt;
}

export function isDebateSide(value: unknown): value is "support" | "against" {
  return value === "support" || value === "against";
}
export function isDebateWinnerSide(value: unknown): value is "support" | "against" | "draw" {
  return value === "support" || value === "against" || value === "draw";
}

export function battleAcceptsInteraction(battle: { endedAt?: Date | null; winnerStatus?: string | null }): boolean {
  return !battle.endedAt && (battle.winnerStatus ?? "undecided") === "undecided";
}