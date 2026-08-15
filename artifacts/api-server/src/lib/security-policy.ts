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

export function resolveTrustedCallbackUrl(candidate: unknown, configured: string, allowed: readonly string[]): string {
  const fallbackOrigin = normalizeOrigin(configured);
  if (!fallbackOrigin) throw new Error("Configured frontend URL must be absolute");
  if (typeof candidate !== "string" || !candidate.trim()) return fallbackOrigin;
  try {
    const parsed = new URL(candidate);
    const trusted = new Set(allowed.map(normalizeOrigin).filter((value): value is string => Boolean(value)));
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return fallbackOrigin;
    if (parsed.origin !== fallbackOrigin && !trusted.has(parsed.origin)) return fallbackOrigin;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return fallbackOrigin;
  }
}
export function destructiveDbToolsEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}

export function debateAcceptsParticipation(debate: { isLive: boolean; isFrozen?: boolean; endedAt?: Date | null; endsAt?: Date | null }, now = new Date()): boolean {
  return debate.isLive && !debate.isFrozen && !debate.endedAt && (!debate.endsAt || debate.endsAt.getTime() > now.getTime());
}

export function validDebateAuthority(creatorIsModerator: boolean, winnerAuthority: unknown): winnerAuthority is "creator" | "admin" {
  return winnerAuthority === "admin" || (creatorIsModerator && winnerAuthority === "creator");
}

export function isDebateSide(value: unknown): value is "support" | "against" {
  return value === "support" || value === "against";
}

export function debateVotePreservesStance(existingSide: unknown, nextSide: unknown): boolean {
  return existingSide == null || existingSide === nextSide;
}

export type DebateSource = { url: string; label: string };
export type DebateSourcesResult =
  | { ok: true; sources: DebateSource[]; serialized: string | null }
  | { ok: false; error: string };

export function normalizeDebateSources(value: unknown): DebateSourcesResult {
  if (value == null || value === "" || value === "null") {
    return { ok: true, sources: [], serialized: null };
  }
  if (typeof value !== "string") return { ok: false, error: "sources must be a JSON array" };

  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return { ok: false, error: "sources must be valid JSON" }; }
  if (!Array.isArray(parsed)) return { ok: false, error: "sources must be a JSON array" };
  if (parsed.length > 10) return { ok: false, error: "A maximum of 10 sources is allowed" };

  const sources: DebateSource[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") return { ok: false, error: "Each source must contain a URL and label" };
    const urlValue = (entry as { url?: unknown }).url;
    const labelValue = (entry as { label?: unknown }).label;
    const url = typeof urlValue === "string" ? urlValue.trim() : "";
    const label = typeof labelValue === "string" ? labelValue.trim() : url;
    if (!url || url.length > 2048 || !label || label.length > 160) {
      return { ok: false, error: "Each source must have a valid URL and a label of 160 characters or fewer" };
    }
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new Error("invalid protocol");
      sources.push({ url: parsedUrl.toString(), label });
    } catch {
      return { ok: false, error: "Source URLs must begin with http:// or https://" };
    }
  }
  return { ok: true, sources, serialized: sources.length > 0 ? JSON.stringify(sources) : null };
}
export function isDebateWinnerSide(value: unknown): value is "support" | "against" | "draw" {
  return value === "support" || value === "against" || value === "draw";
}

export function battleAcceptsInteraction(battle: { endedAt?: Date | null; winnerStatus?: string | null }): boolean {
  return !battle.endedAt && (battle.winnerStatus ?? "undecided") === "undecided";
}

export function mathBattlePermissions(
  battle: {
    endedAt?: Date | null;
    winnerStatus?: string | null;
    creatorUserId?: string | null;
    creatorIsModerator?: boolean | null;
    winnerAuthority?: string | null;
  },
  userId: string | null | undefined,
  adminUserId: string | null | undefined,
): { canParticipate: boolean; canConclude: boolean } {
  const isOpen = battleAcceptsInteraction(battle);
  const isCreatorModerator = Boolean(
    userId && battle.creatorIsModerator && battle.creatorUserId === userId,
  );
  const isAdmin = Boolean(userId && adminUserId && userId === adminUserId);
  return {
    canParticipate: Boolean(userId && isOpen && !isCreatorModerator && !isAdmin),
    canConclude: Boolean(isOpen && (isAdmin || (isCreatorModerator && battle.winnerAuthority !== "admin"))),
  };
}

export function normalizeMathBattleText(value: unknown, maxLength = 4_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

export function validMathBattleStep(stepIndex: unknown, stepCount: number): stepIndex is number {
  return Number.isInteger(stepIndex) && Number(stepIndex) >= 0 && Number(stepIndex) < stepCount;
}
export function reputationReference(...parts: Array<string | number>): number {
  let hash = 0x811c9dc5;
  for (const char of parts.join(":")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash & 0x7fffffff;
}
export type UserProfileUpdate = {
  name?: string;
  title?: string;
  bio?: string;
  avatarUrl?: string | null;
};
export type UserProfileUpdateResult =
  | { ok: true; value: UserProfileUpdate }
  | { ok: false; error: string };

export function normalizeUserProfileUpdate(input: unknown): UserProfileUpdateResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Profile update must be an object" };
  }
  const source = input as Record<string, unknown>;
  const value: UserProfileUpdate = {};

  for (const [field, max] of [["name", 80], ["title", 80], ["bio", 1_000]] as const) {
    if (source[field] === undefined) continue;
    if (typeof source[field] !== "string") return { ok: false, error: `${field} must be text` };
    const normalized = source[field].trim();
    if ((field !== "bio" && normalized.length === 0) || normalized.length > max) {
      return { ok: false, error: `${field} must be ${field === "bio" ? "at most" : "between 1 and"} ${max} characters` };
    }
    value[field] = normalized;
  }

  if (source.avatarUrl !== undefined) {
    if (typeof source.avatarUrl !== "string") return { ok: false, error: "avatarUrl must be text" };
    const avatarUrl = source.avatarUrl.trim();
    if (!avatarUrl) {
      value.avatarUrl = null;
    } else if (avatarUrl.length > 2_048) {
      return { ok: false, error: "avatarUrl is too long" };
    } else {
      try {
        const parsed = new URL(avatarUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported protocol");
        value.avatarUrl = parsed.toString();
      } catch {
        return { ok: false, error: "avatarUrl must be an HTTP(S) URL" };
      }
    }
  }

  if (Object.keys(value).length === 0) return { ok: false, error: "No supported profile fields were provided" };
  return { ok: true, value };
}
