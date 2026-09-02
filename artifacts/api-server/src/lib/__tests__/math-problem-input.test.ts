import assert from "node:assert/strict";
import test from "node:test";
import { CreateMathProblemBody } from "@workspace/api-zod";

const validInput = {
  title: "Prove this divisibility result",
  body: "Prove that the expression is divisible for every positive integer.",
  categoryId: 1,
  difficulty: "intermediate" as const,
};

test("math problem input accepts structured composer metadata", () => {
  const result = CreateMathProblemBody.safeParse({
    ...validInput,
    problemType: "prove",
    tags: ["number-theory", "induction"],
    estimatedMinutes: 30,
    prerequisites: "Mathematical induction",
    isOriginal: true,
  });
  assert.equal(result.success, true);
});

test("math problem input rejects underspecified questions", () => {
  assert.equal(CreateMathProblemBody.safeParse({ ...validInput, title: "Short" }).success, false);
  assert.equal(CreateMathProblemBody.safeParse({ ...validInput, body: "Not enough detail" }).success, false);
});

test("math problem input enforces safe metadata limits", () => {
  assert.equal(CreateMathProblemBody.safeParse({ ...validInput, estimatedMinutes: 0 }).success, false);
  assert.equal(CreateMathProblemBody.safeParse({ ...validInput, estimatedMinutes: 1441 }).success, false);
  assert.equal(CreateMathProblemBody.safeParse({ ...validInput, tags: Array.from({ length: 9 }, (_, index) => `tag-${index}`) }).success, false);
});
