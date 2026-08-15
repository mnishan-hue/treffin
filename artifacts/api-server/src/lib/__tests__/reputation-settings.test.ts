import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ELITE_THRESHOLD, parseEliteThreshold, titleForReputation } from "../reputation-settings";

test("elite threshold parser accepts only bounded whole numbers", () => {
  assert.equal(parseEliteThreshold(2500), 2500);
  assert.equal(parseEliteThreshold("2,500"), null);
  assert.equal(parseEliteThreshold(" 2500 "), 2500);
  assert.equal(parseEliteThreshold(12.5), null);
  assert.equal(parseEliteThreshold("12.5"), null);
  assert.equal(parseEliteThreshold(0), null);
  assert.equal(parseEliteThreshold(1_000_001), null);
  assert.equal(parseEliteThreshold(undefined), null);
});

test("reputation titles follow the configured threshold", () => {
  assert.equal(titleForReputation(0, DEFAULT_ELITE_THRESHOLD), "Novice");
  assert.equal(titleForReputation(100, DEFAULT_ELITE_THRESHOLD), "Thinker");
  assert.equal(titleForReputation(300, DEFAULT_ELITE_THRESHOLD), "Scholar");
  assert.equal(titleForReputation(600, DEFAULT_ELITE_THRESHOLD), "Intellectual");
  assert.equal(titleForReputation(1000, DEFAULT_ELITE_THRESHOLD), "Elite Thinker");
});