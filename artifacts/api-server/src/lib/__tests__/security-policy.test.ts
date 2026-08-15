import test from "node:test";
import assert from "node:assert/strict";
import { battleAcceptsInteraction, collectTrustedOrigins, mathBattlePermissions, normalizeMathBattleText, validMathBattleStep, debateAcceptsParticipation, debateVotePreservesStance, destructiveDbToolsEnabled, isDebateSide, isDebateWinnerSide, normalizeDebateSources, normalizeUserProfileUpdate, resolveTrustedCallbackUrl, resolveTrustedFrontendUrl, validDebateAuthority, reputationReference } from "../security-policy";

test("OAuth callbacks are restricted to configured origins", () => {
  const allowed = ["https://thetreffin.com", "https://admin.thetreffin.com"];
  assert.equal(resolveTrustedFrontendUrl("https://admin.thetreffin.com/path", allowed[0], allowed), "https://admin.thetreffin.com");
  assert.equal(resolveTrustedFrontendUrl("https://evil.example/phish", allowed[0], allowed), "https://thetreffin.com");
  assert.equal(resolveTrustedFrontendUrl("javascript:alert(1)", allowed[0], allowed), "https://thetreffin.com");
  assert.equal(resolveTrustedCallbackUrl("https://thetreffin.com/sign-in?next=%2Fsaved", allowed[0], allowed), "https://thetreffin.com/sign-in?next=%2Fsaved");
  assert.equal(resolveTrustedCallbackUrl("https://evil.example/sign-in", allowed[0], allowed), "https://thetreffin.com");
});

test("trusted origins merge explicit app URLs and remove invalid or duplicate values", () => {
  assert.deepEqual(
    collectTrustedOrigins(
      "https://thetreffin.com, admin.thetreffin.com",
      "https://thetreffin.com/path",
      "not a valid host",
    ),
    ["https://thetreffin.com", "https://admin.thetreffin.com"],
  );
});
test("destructive database tools are disabled in production", () => {
  assert.equal(destructiveDbToolsEnabled("production"), false);
  assert.equal(destructiveDbToolsEnabled("development"), true);
});

test("debate participation requires an open, unfrozen debate", () => {
  assert.equal(debateAcceptsParticipation({ isLive: true }), true);
  assert.equal(debateAcceptsParticipation({ isLive: false }), false);
  assert.equal(debateAcceptsParticipation({ isLive: true, isFrozen: true }), false);
  assert.equal(debateAcceptsParticipation({ isLive: true, endedAt: new Date() }), false);
  assert.equal(debateAcceptsParticipation({ isLive: true, endsAt: new Date("2026-01-01T00:00:00Z") }, new Date("2026-01-02T00:00:00Z")), false);
  assert.equal(debateAcceptsParticipation({ isLive: true, endsAt: new Date("2026-01-03T00:00:00Z") }, new Date("2026-01-02T00:00:00Z")), true);
  assert.equal(validDebateAuthority(true, "creator"), true);
  assert.equal(validDebateAuthority(false, "creator"), false);
  assert.equal(validDebateAuthority(false, "admin"), true);
  assert.equal(isDebateSide("support"), true);
  assert.equal(isDebateSide("other"), false);
});
test("debate outcomes and battle interactions enforce lifecycle values", () => {
  assert.equal(isDebateWinnerSide("draw"), true);
  assert.equal(isDebateWinnerSide("invalid"), false);
  assert.equal(battleAcceptsInteraction({ winnerStatus: "undecided" }), true);
  assert.equal(battleAcceptsInteraction({ winnerStatus: "creator_declared" }), false);
  assert.equal(battleAcceptsInteraction({ winnerStatus: "undecided", endedAt: new Date() }), false);
});
test("math battle permissions keep moderators out of voting and restrict conclusions", () => {
  const battle = { winnerStatus: "undecided", creatorUserId: "creator", creatorIsModerator: true, winnerAuthority: "creator" };
  assert.deepEqual(mathBattlePermissions(battle, "creator", undefined), { canParticipate: false, canConclude: true });
  assert.deepEqual(mathBattlePermissions({ ...battle, winnerAuthority: "admin" }, "creator", undefined), { canParticipate: false, canConclude: false });
  assert.deepEqual(mathBattlePermissions(battle, "member", undefined), { canParticipate: true, canConclude: false });
  assert.deepEqual(mathBattlePermissions(battle, "admin", "admin"), { canParticipate: false, canConclude: true });
  assert.deepEqual(mathBattlePermissions({ ...battle, endedAt: new Date() }, "member", undefined), { canParticipate: false, canConclude: false });
});

test("math battle text and step validation are bounded", () => {
  assert.equal(normalizeMathBattleText("  valid reasoning  "), "valid reasoning");
  assert.equal(normalizeMathBattleText("   "), null);
  assert.equal(normalizeMathBattleText("12345", 4), null);
  assert.equal(validMathBattleStep(0, 2), true);
  assert.equal(validMathBattleStep(1, 2), true);
  assert.equal(validMathBattleStep(2, 2), false);
  assert.equal(validMathBattleStep(-1, 2), false);
  assert.equal(validMathBattleStep(0.5, 2), false);
});

test("debate stances cannot be changed without leaving first", () => {
  assert.equal(debateVotePreservesStance(null, "support"), true);
  assert.equal(debateVotePreservesStance("support", "support"), true);
  assert.equal(debateVotePreservesStance("support", "against"), false);
});
test("debate sources accept only bounded HTTP(S) citations", () => {
  const valid = normalizeDebateSources(JSON.stringify([{ url: "https://example.com/study", label: "Study" }]));
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.sources[0]?.url, "https://example.com/study");
  assert.equal(normalizeDebateSources(JSON.stringify([{ url: "javascript:alert(1)", label: "bad" }])).ok, false);
  assert.equal(normalizeDebateSources("not-json").ok, false);
  assert.equal(normalizeDebateSources(JSON.stringify(Array.from({ length: 11 }, () => ({ url: "https://example.com", label: "x" })))).ok, false);
});
test("composite reputation references are stable per actor and content", () => {
  const first = reputationReference(42, "actor-a");
  assert.equal(first, reputationReference(42, "actor-a"));
  assert.notEqual(first, reputationReference(42, "actor-b"));
  assert.ok(first >= 0);
});
test("profile updates accept only bounded text and HTTP(S) avatar URLs", () => {
  assert.deepEqual(normalizeUserProfileUpdate({ name: "  Ada Lovelace  ", bio: "  Mathematician  ", avatarUrl: "" }), {
    ok: true,
    value: { name: "Ada Lovelace", bio: "Mathematician", avatarUrl: null },
  });
  assert.equal(normalizeUserProfileUpdate({ name: "" }).ok, false);
  assert.equal(normalizeUserProfileUpdate({ bio: "x".repeat(1_001) }).ok, false);
  assert.equal(normalizeUserProfileUpdate({ avatarUrl: "javascript:alert(1)" }).ok, false);
  assert.equal(normalizeUserProfileUpdate({ avatarUrl: "https://example.com/avatar.png" }).ok, true);
  assert.equal(normalizeUserProfileUpdate({ unsupported: true }).ok, false);
});
