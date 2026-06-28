import { Resend } from "resend";
import { logger } from "./logger";

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

export async function sendWelcomeEmail(email: string, firstName: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set — skipping welcome email");
    return;
  }
  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to Treffin — Where Minds Debate 🧠",
      html: buildWelcomeEmail(firstName),
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
