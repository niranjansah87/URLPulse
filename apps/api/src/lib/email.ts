import { Resend } from "resend";
import { apiConfig } from "./env";

/**
 * Transactional email for URLPulse. A thin, focused abstraction over Resend so
 * the rest of the code depends on `emailService`, not the SDK. Only the emails
 * the product actually sends live here (currently: password reset).
 *
 * SECURITY: the reset URL contains the reset token, so it is never written to
 * logs. When RESEND_API_KEY is unset (local dev / tests) the service no-ops with
 * a safe log line — it never prints the URL, token, recipient, or key.
 */
export interface PasswordResetEmailInput {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
}

export interface EmailService {
  sendPasswordReset(input: PasswordResetEmailInput): Promise<void>;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Escape untrusted text before interpolating into the HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render the password-reset email. Pure and exported so tests can assert the
 * subject, CTA, link, expiry, and security note without sending anything.
 */
export function renderPasswordResetEmail(resetUrl: string, expiresMinutes: number): RenderedEmail {
  const safeUrl = escapeHtml(resetUrl);
  const subject = "Reset your URLPulse password";
  const text = [
    "Reset your URLPulse password",
    "",
    "We received a request to reset the password for your URLPulse account.",
    `Open this link to choose a new password (valid for ${expiresMinutes} minutes):`,
    resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email — your password stays the same.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e6e8eb;border-radius:12px;padding:32px;">
          <tr><td style="font-size:18px;font-weight:700;color:#4f46e5;padding-bottom:16px;">URLPulse</td></tr>
          <tr><td style="font-size:16px;font-weight:600;padding-bottom:8px;">Reset your password</td></tr>
          <tr><td style="font-size:14px;line-height:1.5;color:#4a4f57;padding-bottom:20px;">
            We received a request to reset the password for your URLPulse account. Click the button below to choose a new one.
          </td></tr>
          <tr><td style="padding-bottom:20px;">
            <a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">Reset password</a>
          </td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#6b7280;padding-bottom:16px;word-break:break-all;">
            Or paste this link into your browser:<br /><a href="${safeUrl}" style="color:#4f46e5;">${safeUrl}</a>
          </td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#6b7280;">
            This link expires in ${expiresMinutes} minutes. If you didn't request a password reset, you can safely ignore this email — your password won't change.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * Build an email service. Exported (with explicit key/from) so tests can
 * construct a deterministic provider-less instance regardless of the ambient
 * environment; the process singleton below binds it to the real config.
 */
export function createEmailService(
  apiKey: string | undefined,
  from = "URLPulse <noreply@urlpulse.dev>",
): EmailService {
  // No default on apiKey: passing `undefined` must mean "no provider" (a default
  // parameter would resolve `undefined` back to the configured key).
  const client = apiKey ? new Resend(apiKey) : null;

  return {
    async sendPasswordReset({ to, resetUrl, expiresMinutes }) {
      const { subject, html, text } = renderPasswordResetEmail(resetUrl, expiresMinutes);
      if (!client) {
        // No provider configured (local dev / tests): do not send, and never log
        // the URL/token/recipient.
        console.info("[email] password reset email skipped: RESEND_API_KEY not set");
        return;
      }
      const { error } = await client.emails.send({
        from,
        to,
        subject,
        html,
        text,
      });
      if (error) {
        // Surface a provider failure to the caller (which logs it safely and
        // still returns a generic response); never include the reset URL/token.
        throw new Error(`Resend send failed: ${error.message}`);
      }
    },
  };
}

/** Process-wide email service. Exported as an object so it can be spied in tests. */
export const emailService: EmailService = createEmailService(
  apiConfig.RESEND_API_KEY,
  apiConfig.RESEND_FROM_EMAIL,
);
