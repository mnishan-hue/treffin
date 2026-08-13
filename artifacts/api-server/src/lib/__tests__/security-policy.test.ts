import test from "node:test";
import assert from "node:assert/strict";
import { battleAcceptsInteraction, collectTrustedOrigins, debateAcceptsParticipation, destructiveDbToolsEnabled, isDebateSide, isDebateWinnerSide, resolveTrustedFrontendUrl, validDebateAuthority, reputationReference } from "../security-policy";

test("OAuth callbacks are restricted to configured origins", () => {
  const allowed = ["https://thetreffin.com", "https://admin.thetreffin.com"];
  assert.equal(resolveTrustedFrontendUrl("https://admin.thetreffin.com/path", allowed[0], allowed), "https://admin.thetreffin.com");
  assert.equal(resolveTrustedFrontendUrl("https://evil.example/phish", allowed[0], allowed), "https://thetreffin.com");
  assert.equal(resolveTrustedFrontendUrl("javascript:alert(1)", allowed[0], allowed), "https://thetreffin.com");
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
test("composite reputation references are stable per actor and content", () => {
  const first = reputationReference(42, "actor-a");
  assert.equal(first, reputationReference(42, "actor-a"));
  assert.notEqual(first, reputationReference(42, "actor-b"));
  assert.ok(first >= 0);
});