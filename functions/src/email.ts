import { logger } from "firebase-functions/v2";
import { defineSecret, defineString } from "firebase-functions/params";

/**
 * Transactional email through Resend (https://resend.com), called with plain fetch, no SDK.
 * The API key lives in Secret Manager (`firebase functions:secrets:set RESEND_API_KEY`).
 * On the emulators the email is written to the log instead of being sent.
 */
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
// Until the domain is verified in Resend, its test sender can only email the Resend account owner
export const MAIL_FROM = defineString("MAIL_FROM", { default: "VaultDocAI <onboarding@resend.dev>" });
// Public address of the website, used in links inside emails
export const APP_URL = defineString("APP_URL", { default: "http://localhost:3000" });

type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string };

export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    logger.info("[dev mail] not sent on the emulators", { to: mail.to, subject: mail.subject, text: mail.text });
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY.value()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM.value(),
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "Asha shared “Rent agreement.pdf” with you" — simple, inline-styled HTML that renders in every mail app. */
export function shareInviteMail(o: {
  to: string;
  fromName: string;
  fromEmail: string;
  itemName: string;
  isFolder: boolean;
  link: string;
  message?: string;
  expiresAt: Date | null;
  /** "Only people you invite" links ask the recipient to log in as the invited email */
  requiresLogin: boolean;
}): Mail {
  const what = o.isFolder ? "a folder" : "a file";
  const expiry = o.expiresAt
    ? `This link works until ${o.expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}.`
    : "";
  const note = o.message?.trim()
    ? `<p style="margin:0 0 20px;padding:12px 14px;border-left:3px solid #c96442;background:#faf9f5;color:#3d3d3a;font-size:15px;line-height:1.5">${escape(o.message.trim())}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f4ed;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e8e6dc;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font-family:Georgia,serif;font-size:22px;color:#141413">🔒 VaultDocAI</td></tr>
<tr><td style="padding:8px 28px 28px;color:#141413">
<p style="margin:0 0 16px;font-size:17px;line-height:1.5"><b>${escape(o.fromName)}</b> shared ${what} with you</p>
<p style="margin:0 0 20px;font-size:16px;padding:14px 16px;border:1px solid #e8e6dc;border-radius:12px">${o.isFolder ? "📁" : "📄"} ${escape(o.itemName)}</p>
${note}
<a href="${o.link}" style="display:inline-block;background:#141413;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:15px;font-weight:600">Open</a>
<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b6a63">${o.requiresLogin ? `You'll be asked to log in as ${escape(o.to)} to open it. ` : ""}${expiry}<br>Sent by ${escape(o.fromEmail)} using VaultDocAI. If you weren't expecting this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${o.fromName} shared ${what} with you: ${o.itemName}\n${o.message?.trim() ? `\n"${o.message.trim()}"\n` : ""}\nOpen: ${o.link}\n\n${o.requiresLogin ? `You'll be asked to log in as ${o.to}. ` : ""}${expiry}\nSent by ${o.fromEmail} using VaultDocAI.`;
  return { to: o.to, subject: `${o.fromName} shared “${o.itemName}” with you`, html, text, replyTo: o.fromEmail };
}
