import assert from "node:assert/strict";
import test from "node:test";
import { buildLoginOtpEmail, buildProfessionalWelcomeEmail } from "../email-branding";

test("login OTP email is branded, responsive, escaped, and includes a text fallback", () => {
  process.env.FRONTEND_URL = "https://thetreffin.com";
  const message = buildLoginOtpEmail('<script>alert("x")</script>', "123456");

  assert.match(message.html, /treffin-mark\.png/);
  assert.match(message.html, /max-width:580px/);
  assert.match(message.html, /123456/);
  assert.doesNotMatch(message.html, /<script>alert/);
  assert.match(message.text, /expires in 5 minutes/i);
});

test("welcome email invites a new member once with the canonical frontend URL", () => {
  process.env.FRONTEND_URL = "https://thetreffin.com";
  const message = buildProfessionalWelcomeEmail("Asha");

  assert.match(message.html, /part of the change, Asha/i);
  assert.match(message.html, /https:\/\/thetreffin\.com/);
  assert.match(message.text, /Welcome to Treffin, Asha/i);
});
