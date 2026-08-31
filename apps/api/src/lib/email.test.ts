import { describe, it, expect, vi } from "vitest";
import { renderPasswordResetEmail, createEmailService } from "./email";

const RESET_URL = "http://localhost:3000/reset-password?token=abc123";

describe("renderPasswordResetEmail", () => {
  it("uses a clear password-reset subject", () => {
    expect(renderPasswordResetEmail(RESET_URL, 60).subject).toBe("Reset your URLPulse password");
  });

  it("includes the reset URL as the CTA link", () => {
    expect(renderPasswordResetEmail(RESET_URL, 60).html).toContain(`href="${RESET_URL}"`);
  });

  it("states the expiry in the body", () => {
    expect(renderPasswordResetEmail(RESET_URL, 60).text).toContain("60 minutes");
  });

  it("includes a security note to ignore unrequested emails", () => {
    expect(renderPasswordResetEmail(RESET_URL, 60).text.toLowerCase()).toContain("ignore this email");
  });

  it("escapes HTML in the URL to prevent injection", () => {
    const html = renderPasswordResetEmail("http://x/reset?token=a&b=\"<script>", 60).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&amp;");
  });
});

describe("emailService without a provider (dev/test)", () => {
  it("no-ops without throwing and never logs the reset URL or token", async () => {
    // Construct a provider-less instance explicitly so the test is deterministic
    // regardless of whether RESEND_API_KEY is set in the environment.
    const service = createEmailService(undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(
      service.sendPasswordReset({ to: "u@example.com", resetUrl: RESET_URL, expiresMinutes: 60 }),
    ).resolves.toBeUndefined();
    for (const call of info.mock.calls) {
      const line = call.map(String).join(" ");
      expect(line).not.toContain("abc123");
      expect(line).not.toContain(RESET_URL);
    }
    info.mockRestore();
  });
});
