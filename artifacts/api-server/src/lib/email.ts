import { Resend } from "resend";
import { logger } from "./logger";
import { buildLoginOtpEmail, buildProfessionalWelcomeEmail } from "./email-branding";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "placeholder");
  }
  return _resend;
}
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Treffin <onboarding@resend.dev>";

const BG = "#07101f";
const CARD_BG = "#0d1b30";
const BORDER = "#1e3050";
const ACCENT1 = "#2563EB";
const ACCENT2 = "#4F6AF7";
const TEXT_PRIMARY = "#f1f5f9";
const TEXT_SECONDARY = "#94a3b8";
const TEXT_MUTED = "#64748b";
const PILL_BG = "#111e35";

function buildWelcomeEmail(firstName: string): string {
  const name = firstName || "there";
  const appUrl =
    process.env.APP_URL ??
    (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://treffin.replit.app");
  const year = new Date().getFullYear();

  const features = [
    { icon: "⚡", title: "Debate ideas", desc: "Oxford-format live debates with quality scoring and source citations" },
    { icon: "✍️", title: "Write long-form articles", desc: "500+ word deep dives with expert peer review from the community" },
    { icon: "🏆", title: "Build your reputation", desc: "Earn rep points and rank badges through consistent quality contributions" },
    { icon: "🌐", title: "Join communities", desc: "Philosophy, AI, Politics, Science and more — find your intellectual home" },
  ];

  const featureRows = features.map(f => `
    <tr>
      <td style="padding:0 0 12px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:${PILL_BG};border:1px solid ${BORDER};border-radius:12px;">
          <tr>
            <td style="padding:16px 18px;width:54px;vertical-align:top;">
              <div style="width:38px;height:38px;background:rgba(79,106,247,0.1);border-radius:10px;text-align:center;line-height:38px;font-size:18px;">${f.icon}</div>
            </td>
            <td style="padding:18px 18px 18px 0;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:${TEXT_PRIMARY};">${f.title}</p>
              <p style="margin:0;font-size:13px;color:${TEXT_SECONDARY};line-height:1.5;">${f.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Welcome to Treffin</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0">

          <!-- Logo + Motto -->
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <img src="${appUrl}/treffin-logo-transparent.png" alt="Treffin" width="160" style="display:block;margin:0 auto 8px;width:160px;height:auto;" />
              <p style="margin:0;font-size:11px;font-weight:600;color:${TEXT_MUTED};letter-spacing:2px;text-transform:uppercase;">Where Minds Debate.</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${CARD_BG};border-radius:20px;border:1px solid ${BORDER};overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Top gradient bar -->
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,${ACCENT1} 0%,${ACCENT2} 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Hero -->
                <tr>
                  <td style="padding:44px 48px 32px;">
                    <!-- Badge -->
                    <div style="margin-bottom:20px;">
                      <span style="display:inline-block;background:rgba(79,106,247,0.12);border:1px solid rgba(79,106,247,0.25);border-radius:100px;padding:5px 14px;font-size:12px;font-weight:600;color:${ACCENT2};letter-spacing:0.5px;text-transform:uppercase;">Welcome to Treffin</span>
                    </div>
                    <h1 style="margin:0 0 14px;font-size:28px;font-weight:800;color:${TEXT_PRIMARY};line-height:1.2;letter-spacing:-0.5px;">Welcome, ${name}. 👋</h1>
                    <p style="margin:0;font-size:16px;color:${TEXT_SECONDARY};line-height:1.75;">
                      You've just joined a community built for <span style="color:${TEXT_PRIMARY};font-weight:600;">serious thinkers</span> — people who debate ideas, write long-form articles, and build reputation through intellectual rigour.
                    </p>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="height:1px;background:${BORDER};margin:0 48px;font-size:0;line-height:0;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0 48px;"><div style="height:1px;background:${BORDER};"></div></td></tr></table>
                  </td>
                </tr>

                <!-- Features -->
                <tr>
                  <td style="padding:32px 48px 0;">
                    <p style="margin:0 0 20px;font-size:11px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:1.5px;">What awaits you</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${featureRows}
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding:24px 48px 44px;text-align:center;">
                    <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,${ACCENT1} 0%,${ACCENT2} 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 40px;border-radius:12px;letter-spacing:0.2px;">
                      Start exploring Treffin →
                    </a>
                    <p style="margin:20px 0 0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
                      You're receiving this because you just joined Treffin.<br/>Quality over noise. Always.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="border-top:1px solid ${BORDER};padding:18px 48px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:${TEXT_MUTED};">© ${year} Treffin</td>
                        <td align="right" style="font-size:12px;color:${TEXT_MUTED};">Where Minds Debate</td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDebateOutcomeEmail(
  email: string,
  firstName: string,
  debateTitle: string,
  result: "won" | "lost" | "draw"
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const appUrl = process.env.APP_URL ?? (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://treffin.replit.app");
  const name = firstName || "Thinker";
  const emoji = result === "won" ? "🏆" : result === "draw" ? "🤝" : "💪";
  const headline = result === "won" ? "You won the debate!" : result === "draw" ? "The debate ended in a draw" : "Debate outcome declared";
  const subtext = result === "won"
    ? "Congratulations — your side prevailed. Your reputation has been updated."
    : result === "draw"
    ? "Both sides argued well — this one ended with no clear winner."
    : "The debate has concluded. Keep sharpening your arguments for the next one.";
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${emoji} ${headline} — Treffin`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:${BG};font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 0;"><tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
<tr><td style="height:4px;background:linear-gradient(90deg,${ACCENT1},${ACCENT2});font-size:0;"></td></tr>
<tr><td style="padding:40px 44px;">
  <p style="margin:0 0 6px;font-size:32px;">${emoji}</p>
  <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${TEXT_PRIMARY};">${headline}</h1>
  <p style="margin:0 0 20px;font-size:15px;color:${TEXT_SECONDARY};line-height:1.7;">Hi ${name}, ${subtext}</p>
  <div style="background:${PILL_BG};border:1px solid ${BORDER};border-radius:12px;padding:16px 20px;margin:0 0 24px;">
    <p style="margin:0;font-size:12px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Debate</p>
    <p style="margin:6px 0 0;font-size:15px;color:${TEXT_PRIMARY};font-weight:600;">${debateTitle}</p>
  </div>
  <a href="${appUrl}/debates" style="display:inline-block;background:linear-gradient(135deg,${ACCENT1},${ACCENT2});color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:10px;">View your debates →</a>
</td></tr>
<tr><td style="padding:16px 44px;border-top:1px solid ${BORDER};"><p style="margin:0;font-size:12px;color:${TEXT_MUTED};">© ${new Date().getFullYear()} Treffin — Where Minds Debate</p></td></tr>
</table></td></tr></table></body></html>`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send debate outcome email");
  }
}

export async function sendSuspensionEmail(
  email: string,
  firstName: string,
  suspended: boolean,
  reason?: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const name = firstName || "there";
  const subject = suspended ? "Important notice about your Treffin account" : "Your Treffin account has been reinstated";
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:${BG};font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 0;"><tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
<tr><td style="height:4px;background:linear-gradient(90deg,${suspended ? "#dc2626,#ef4444" : `${ACCENT1},${ACCENT2}`});font-size:0;"></td></tr>
<tr><td style="padding:40px 44px;">
  <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${TEXT_PRIMARY};">${suspended ? "Account suspended" : "Account reinstated ✅"}</h1>
  <p style="margin:0 0 16px;font-size:15px;color:${TEXT_SECONDARY};line-height:1.7;">Hi ${name}, ${suspended ? "your Treffin account has been temporarily suspended by our moderation team." : "your Treffin account suspension has been lifted. Welcome back."}</p>
  ${reason && suspended ? `<div style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:14px 18px;margin:0 0 20px;"><p style="margin:0;font-size:13px;color:${TEXT_SECONDARY};">Reason: ${reason}</p></div>` : ""}
  <p style="margin:0;font-size:13px;color:${TEXT_MUTED};">${suspended ? "If you believe this is a mistake, you can submit a content appeal from the Treffin platform." : "You can now log in and participate again."}</p>
</td></tr>
<tr><td style="padding:16px 44px;border-top:1px solid ${BORDER};"><p style="margin:0;font-size:12px;color:${TEXT_MUTED};">© ${new Date().getFullYear()} Treffin</p></td></tr>
</table></td></tr></table></body></html>`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send suspension email");
  }
}

export async function sendWelcomeEmail(email: string, firstName: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set — skipping welcome email");
    return;
  }
  try {
    const welcome = buildProfessionalWelcomeEmail(firstName);
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to Treffin — Where Minds Debate 🧠",
      html: welcome.html,
      text: welcome.text,
    });
    if (error) {
      logger.error({ error }, "Failed to send welcome email via Resend");
    } else {
      logger.info({ email }, "Welcome email sent successfully");
    }
  } catch (err) {
    logger.error({ err }, "Exception sending welcome email");
  }
}

function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendLoginOtpEmail(
  email: string,
  displayName: string,
  otp: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.error("RESEND_API_KEY not set - login OTP email cannot be sent");
    throw new Error("Login email service is not configured");
  }

  const message = buildLoginOtpEmail(displayName, otp);
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${otp} is your Treffin sign-in code`,
    html: message.html,
    text: message.text,
  });

  if (error) {
    logger.error({ error }, "Failed to send login OTP via Resend");
    throw new Error("Login email provider rejected the OTP request");
  }
  logger.info({ email }, "Login OTP email sent");
}

export async function sendPasswordResetEmail(
  email: string,
  displayName: string,
  resetUrl: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set - password reset email was not sent");
    return;
  }
  const name = escapeEmailHtml(displayName?.trim() || "there");
  const safeUrl = escapeEmailHtml(resetUrl);
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your Treffin password",
    html: `<!doctype html><html><body style="margin:0;padding:32px;background:${BG};font-family:Arial,sans-serif;color:${TEXT_PRIMARY}">
      <table role="presentation" width="100%"><tr><td align="center">
        <table role="presentation" width="520" style="max-width:100%;background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px">
          <tr><td style="padding:36px">
            <h1 style="margin:0 0 16px;font-size:24px">Reset your password</h1>
            <p style="color:${TEXT_SECONDARY};line-height:1.6">Hi ${name}, use the secure link below to choose a new Treffin password. The link expires in one hour.</p>
            <p style="margin:28px 0"><a href="${safeUrl}" style="background:${ACCENT2};color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700">Reset password</a></p>
            <p style="color:${TEXT_MUTED};font-size:13px;line-height:1.5">If you did not request this, you can safely ignore this email.</p>
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`,
  });
  if (error) throw new Error(`Password reset email provider rejected the request: ${error.message}`);
}
