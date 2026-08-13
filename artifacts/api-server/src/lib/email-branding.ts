const BG = "#07101f";
const CARD = "#0d1b30";
const BORDER = "#1e3050";
const PRIMARY = "#f8fafc";
const SECONDARY = "#a8b3c7";
const MUTED = "#718096";
const ACCENT = "#4f6af7";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function publicAppUrl(): string {
  const configured = process.env.FRONTEND_URL ?? process.env.APP_URL ?? "https://thetreffin.com";
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.hostname === "localhost"
      ? url.origin
      : "https://thetreffin.com";
  } catch {
    return "https://thetreffin.com";
  }
}

function shell(title: string, preheader: string, content: string): string {
  const appUrl = escapeHtml(publicAppUrl());
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:${BG};font-family:Inter,Segoe UI,Arial,sans-serif;color:${PRIMARY}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${BG}">
    <tr><td align="center" style="padding:32px 14px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px">
        <tr><td style="padding:0 8px 24px;text-align:center">
          <img src="${appUrl}/treffin-mark.png" width="48" height="48" alt="Treffin" style="display:inline-block;width:48px;height:48px;border:0">
          <div style="margin-top:8px;font-size:22px;font-weight:800;letter-spacing:-.4px;color:${PRIMARY}">Treffin</div>
          <div style="margin-top:3px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${MUTED}">Where minds debate</div>
        </td></tr>
        <tr><td style="overflow:hidden;border:1px solid ${BORDER};border-radius:20px;background:${CARD}">
          <div style="height:4px;background:${ACCENT}"></div>
          <div style="padding:40px 32px">${content}</div>
        </td></tr>
        <tr><td style="padding:22px 12px 0;text-align:center;font-size:12px;line-height:1.6;color:${MUTED}">
          &copy; ${new Date().getFullYear()} Treffin &middot; Quality over noise, always.<br>
          <a href="${appUrl}" style="color:${SECONDARY};text-decoration:none">thetreffin.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function buildLoginOtpEmail(displayName: string, otp: string): { html: string; text: string } {
  const name = escapeHtml(displayName?.trim().split(/\s+/)[0] || "Thinker");
  const safeOtp = escapeHtml(otp);
  const html = shell(
    "Your Treffin sign-in code",
    `${otp} is your Treffin sign-in code. It expires in 5 minutes.`,
    `<div style="display:inline-block;padding:5px 12px;border:1px solid rgba(79,106,247,.35);border-radius:999px;background:rgba(79,106,247,.12);font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#8fa0ff">Secure sign-in</div>
     <h1 style="margin:20px 0 12px;font-size:27px;line-height:1.2;color:${PRIMARY}">Confirm it&rsquo;s you</h1>
     <p style="margin:0;font-size:15px;line-height:1.75;color:${SECONDARY}">Hi ${name}, enter this one-time code to finish signing in to Treffin.</p>
     <div style="margin:28px 0;padding:20px 12px;border:1px solid ${BORDER};border-radius:14px;background:#091426;text-align:center;font-size:34px;font-weight:800;letter-spacing:10px;color:${PRIMARY}">${safeOtp}</div>
     <p style="margin:0;font-size:13px;line-height:1.65;color:${MUTED}">This code expires in <strong style="color:${SECONDARY}">5 minutes</strong>. Never share it with anyone. Treffin will never ask for this code outside the sign-in screen.</p>
     <p style="margin:22px 0 0;padding-top:20px;border-top:1px solid ${BORDER};font-size:12px;line-height:1.6;color:${MUTED}">If you did not try to sign in, you can ignore this email and your account will remain secure.</p>`,
  );
  return { html, text: `Hi ${displayName || "Thinker"}, your Treffin sign-in code is ${otp}. It expires in 5 minutes. Never share this code.` };
}

export function buildProfessionalWelcomeEmail(firstName: string): { html: string; text: string } {
  const name = escapeHtml(firstName?.trim() || "Thinker");
  const appUrl = escapeHtml(publicAppUrl());
  const html = shell(
    "Welcome to Treffin",
    "Welcome to Treffin - thank you for being part of a community changing how ideas are discussed.",
    `<div style="display:inline-block;padding:5px 12px;border:1px solid rgba(79,106,247,.35);border-radius:999px;background:rgba(79,106,247,.12);font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#8fa0ff">Welcome to Treffin</div>
     <h1 style="margin:20px 0 12px;font-size:29px;line-height:1.2;color:${PRIMARY}">You&rsquo;re part of the change, ${name}.</h1>
     <p style="margin:0;font-size:16px;line-height:1.75;color:${SECONDARY}">Thank you for joining a community where thoughtful disagreement creates understanding, evidence matters, and every serious idea gets room to grow.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 24px">
       <tr><td style="padding:14px 16px;border:1px solid ${BORDER};border-radius:12px;background:#091426;color:${SECONDARY};font-size:14px;line-height:1.55"><strong style="color:${PRIMARY}">Debate with purpose</strong><br>Challenge ideas while respecting the people behind them.</td></tr>
       <tr><td height="10"></td></tr>
       <tr><td style="padding:14px 16px;border:1px solid ${BORDER};border-radius:12px;background:#091426;color:${SECONDARY};font-size:14px;line-height:1.55"><strong style="color:${PRIMARY}">Publish meaningful work</strong><br>Turn careful thinking into articles the community can review.</td></tr>
       <tr><td height="10"></td></tr>
       <tr><td style="padding:14px 16px;border:1px solid ${BORDER};border-radius:12px;background:#091426;color:${SECONDARY};font-size:14px;line-height:1.55"><strong style="color:${PRIMARY}">Build trusted reputation</strong><br>Earn recognition through consistent, constructive contributions.</td></tr>
     </table>
     <div style="text-align:center"><a href="${appUrl}" style="display:inline-block;padding:14px 28px;border-radius:11px;background:${ACCENT};color:#fff;font-size:14px;font-weight:800;text-decoration:none">Enter Treffin &rarr;</a></div>`,
  );
  return { html, text: `Welcome to Treffin, ${firstName || "Thinker"}. Thank you for being part of a community changing how ideas are discussed. Start exploring at ${publicAppUrl()}.` };
}
