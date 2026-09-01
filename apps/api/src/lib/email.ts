import { Resend } from "resend";
import { apiConfig } from "./env";

/**
 * URLPulse transactional email system.
 *
 * One reusable layout (`renderEmail`) + four templates (welcome, verification,
 * password reset, password reset success) + a Resend-backed service. Templates
 * share the header, card, CTA button, security notice, and footer, so they read
 * as one product - matching the brand references (light card on a light ground,
 * URLPulse blue CTA, navy headings, the horizontal brand logo in the header)
 * while staying email-client safe (tables + inline CSS, no JS, no web fonts, an
 * emoji hero instead of a heavy per-template illustration). The logo is the one
 * embedded image and degrades to its "URLPulse" alt text when images are
 * blocked; every headline/CTA remains text.
 *
 * Boundaries: this module only DELIVERS email. Better Auth owns tokens, expiry,
 * hashing, and sessions; callers pass already-built, trusted URLs (derived from
 * the configured WEB_ORIGIN, never a request Host header). Dynamic values are
 * HTML-escaped. Tokens/keys/recipients are never logged.
 */

// --- Brand palette (inlined; email clients do not support CSS variables) ---
const C = {
  bg: "#f1f5f9",
  card: "#ffffff",
  border: "#e2e8f0",
  navy: "#0f172a",
  body: "#475569",
  muted: "#64748b",
  blue: "#2563eb",
  brandDark: "#0f172a",
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Absolute asset origin for images embedded in email (email clients require
 * absolute HTTPS URLs and never resolve relative paths). The horizontal brand
 * logo is served from the web app's public dir.
 */
const ASSET_ORIGIN = apiConfig.WEB_ORIGIN.replace(/\/$/, "");
const LOGO_URL = `${ASSET_ORIGIN}/brand/logo/horizontal/urlpulse-light.png`;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface EmailContent {
  /** Hidden preheader shown in the inbox preview. */
  preview: string;
  /** Emoji hero (email-safe, tiny payload) shown in a tinted circle. */
  heroEmoji: string;
  heroTint: string;
  heading: string;
  /** Body paragraphs; escaped before rendering. */
  intro: string[];
  cta: { label: string; url: string };
  /** e.g. "This link will expire in 1 hour." Rendered only when present. */
  expiryNote?: string;
  /** Security notice (safe-to-ignore / contact-support). Optional. */
  security?: string;
  /** Small helper line in the footer (e.g. welcome support pointer). Optional. */
  footerHelp?: string;
}

/**
 * Escape untrusted text before interpolating into HTML. Covers the characters
 * dangerous in element content and in double-quoted attribute values (all
 * attributes here are double-quoted, so `'` need not be escaped).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Greeting line: "Hi Name," when a name is known, otherwise "Hi there,". */
function greeting(name?: string): string {
  const trimmed = name?.trim();
  return trimmed ? `Hi ${trimmed},` : "Hi there,";
}

/** Human-friendly duration for expiry copy: 60 → "1 hour", 1440 → "24 hours". */
export function humanDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

const FOOTER_TAGLINE = "Real-time URL monitoring for teams who care about uptime.";

/**
 * The shared email shell. Renders both HTML and a deliberate plain-text version
 * from the same content, so the two never drift.
 */
function renderEmail(content: EmailContent): { html: string; text: string } {
  const { preview, heroEmoji, heroTint, heading, intro, cta, expiryNote, security, footerHelp } = content;
  const safeUrl = escapeHtml(cta.url);
  const year = new Date().getUTCFullYear();

  const introHtml = intro
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.body};">${escapeHtml(p)}</p>`,
    )
    .join("");

  const expiryHtml = expiryNote
    ? `<p style="margin:20px 0 0;font-size:13px;color:${C.muted};">${escapeHtml(expiryNote)}</p>`
    : "";

  const securityHtml = security
    ? `<div style="margin:24px 0 0;padding:12px 16px;background:#f8fafc;border:1px solid ${C.border};border-radius:8px;">
         <p style="margin:0;font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(security)}</p>
       </div>`
    : "";

  const footerHelpHtml = footerHelp
    ? `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(footerHelp)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td style="padding:0 4px 20px;">
                <img src="${LOGO_URL}" alt="URLPulse" height="28" style="height:28px;display:block;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:40px 36px;text-align:center;">
                <div style="width:72px;height:72px;line-height:72px;margin:0 auto 20px;border-radius:50%;background:${heroTint};font-size:34px;">${heroEmoji}</div>
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:${C.navy};">${escapeHtml(heading)}</h1>
                <div style="text-align:center;">${introHtml}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
                  <tr>
                    <td align="center" bgcolor="${C.blue}" style="border-radius:8px;">
                      <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${C.muted};word-break:break-all;">
                  If the button doesn't work, copy and paste this link into your browser:<br />
                  <a href="${safeUrl}" target="_blank" rel="noopener" style="color:${C.blue};text-decoration:underline;">${safeUrl}</a>
                </p>
                ${expiryHtml}
                ${securityHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 8px 0;text-align:center;">
                ${footerHelpHtml}
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${C.navy};">URLPulse</p>
                <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:${C.muted};">${FOOTER_TAGLINE}</p>
                <p style="margin:0 0 12px;">
                  <a href="${ASSET_ORIGIN}" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;color:${C.blue};text-decoration:none;">Visit URLPulse &rarr;</a>
                </p>
                <p style="margin:0;font-size:12px;color:${C.muted};">© ${year} URLPulse. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    "URLPulse",
    "",
    heading,
    "",
    ...intro,
    "",
    `${cta.label}:`,
    cta.url,
  ];
  if (expiryNote) textLines.push("", expiryNote);
  if (security) textLines.push("", security);
  textLines.push("", "-", "URLPulse", FOOTER_TAGLINE, ASSET_ORIGIN, `© ${year} URLPulse. All rights reserved.`);
  const text = textLines.join("\n");

  return { html, text };
}

// --- Templates -------------------------------------------------------------

export function renderWelcomeEmail(name: string | undefined, dashboardUrl: string): RenderedEmail {
  const { html, text } = renderEmail({
    preview: "Your URLPulse account is ready - start monitoring your URLs.",
    heroEmoji: "🎉",
    heroTint: "#eff6ff",
    heading: "Welcome to URLPulse!",
    intro: [
      greeting(name),
      "We're excited to have you on board. Start monitoring your URLs, track uptime, and get real-time results.",
    ],
    cta: { label: "Go to Dashboard", url: dashboardUrl },
    footerHelp: "Need help getting started? Check out our documentation or contact support.",
  });
  return { subject: "Welcome to URLPulse", html, text };
}

export function renderVerificationEmail(
  name: string | undefined,
  verifyUrl: string,
  expiresMinutes: number,
): RenderedEmail {
  const { html, text } = renderEmail({
    preview: "Verify your email to activate your URLPulse account.",
    heroEmoji: "✉️",
    heroTint: "#eff6ff",
    heading: "Verify your email address",
    intro: [
      greeting(name),
      "Thanks for signing up for URLPulse. Please verify your email address to activate your account and start monitoring your URLs.",
    ],
    cta: { label: "Verify Email Address", url: verifyUrl },
    expiryNote: `This link will expire in ${humanDuration(expiresMinutes)}.`,
    security: "If you didn't create an account with URLPulse, you can safely ignore this email.",
  });
  return { subject: "Verify your URLPulse email", html, text };
}

export function renderPasswordResetEmail(
  name: string | undefined,
  resetUrl: string,
  expiresMinutes: number,
): RenderedEmail {
  const { html, text } = renderEmail({
    preview: "Reset your URLPulse password.",
    heroEmoji: "🔒",
    heroTint: "#eff6ff",
    heading: "Reset your password",
    intro: [
      greeting(name),
      "We received a request to reset your password for your URLPulse account. Click the button below to set a new password.",
    ],
    cta: { label: "Reset Password", url: resetUrl },
    expiryNote: `This link will expire in ${humanDuration(expiresMinutes)}.`,
    security:
      "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
  });
  return { subject: "Reset your URLPulse password", html, text };
}

export function renderPasswordResetSuccessEmail(
  name: string | undefined,
  signInUrl: string,
): RenderedEmail {
  const { html, text } = renderEmail({
    preview: "Your URLPulse password was changed.",
    heroEmoji: "🛡️",
    heroTint: "#ecfdf5",
    heading: "Password updated successfully",
    intro: [
      greeting(name),
      "Your password has been updated successfully. For your security, your other active sessions have been signed out. You can now sign in with your new password.",
    ],
    cta: { label: "Sign In Now", url: signInUrl },
    security: "If you didn't change your password, please contact our support team immediately.",
  });
  return { subject: "Your URLPulse password was changed", html, text };
}

// --- Service ---------------------------------------------------------------

export interface PasswordResetEmailInput {
  to: string;
  name?: string;
  resetUrl: string;
  expiresMinutes: number;
}
export interface WelcomeEmailInput {
  to: string;
  name?: string;
  dashboardUrl: string;
}
export interface VerificationEmailInput {
  to: string;
  name?: string;
  verifyUrl: string;
  expiresMinutes: number;
}
export interface PasswordResetSuccessEmailInput {
  to: string;
  name?: string;
  signInUrl: string;
}

export interface EmailService {
  sendWelcome(input: WelcomeEmailInput): Promise<void>;
  sendVerification(input: VerificationEmailInput): Promise<void>;
  sendPasswordReset(input: PasswordResetEmailInput): Promise<void>;
  sendPasswordResetSuccess(input: PasswordResetSuccessEmailInput): Promise<void>;
}

/** Strip CR/LF from a recipient address as defense-in-depth against header
 * injection (Resend's JSON API does not build raw headers, but never pass
 * newlines through regardless). */
function sanitizeRecipient(to: string): string {
  return to.replace(/[\r\n]/g, "").trim();
}

/**
 * Build an email service. Exported with an explicit key/from so tests can
 * construct a deterministic provider-less instance regardless of the ambient
 * environment; the process singleton below binds it to the real config. No
 * default on `apiKey`: passing `undefined` must mean "no provider" (a default
 * parameter would resolve `undefined` back to the configured key).
 */
export function createEmailService(
  apiKey: string | undefined,
  from = "URLPulse <noreply@urlpulse.dev>",
): EmailService {
  const client = apiKey ? new Resend(apiKey) : null;

  async function send(to: string, rendered: RenderedEmail): Promise<void> {
    if (!client) {
      // No provider configured (local dev / tests): do not send, and never log
      // the URL/token/recipient.
      console.info("[email] transactional email skipped: RESEND_API_KEY not set");
      return;
    }
    const { error } = await client.emails.send({
      from,
      to: sanitizeRecipient(to),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (error) {
      // Surface a provider failure to the caller (which logs it safely); never
      // include the URL/token.
      throw new Error(`Resend send failed: ${error.message}`);
    }
  }

  return {
    sendWelcome: ({ to, name, dashboardUrl }) => send(to, renderWelcomeEmail(name, dashboardUrl)),
    sendVerification: ({ to, name, verifyUrl, expiresMinutes }) =>
      send(to, renderVerificationEmail(name, verifyUrl, expiresMinutes)),
    sendPasswordReset: ({ to, name, resetUrl, expiresMinutes }) =>
      send(to, renderPasswordResetEmail(name, resetUrl, expiresMinutes)),
    sendPasswordResetSuccess: ({ to, name, signInUrl }) =>
      send(to, renderPasswordResetSuccessEmail(name, signInUrl)),
  };
}

/** Process-wide email service. Exported as an object so it can be spied in tests. */
export const emailService: EmailService = createEmailService(
  apiConfig.RESEND_API_KEY,
  apiConfig.RESEND_FROM_EMAIL,
);
