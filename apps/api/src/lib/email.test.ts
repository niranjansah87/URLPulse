import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture Resend sends without a network call - no real email is ever sent.
interface SendPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}
const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(async (_payload: SendPayload) => ({
    data: { id: "test" } as { id: string } | null,
    error: null as { message: string } | null,
  })),
}));
// A regular function (not an arrow) so `new Resend()` constructs: vitest 4
// invokes the mock implementation with [[Construct]], which arrows reject.
vi.mock("resend", () => ({ Resend: vi.fn(function () { return { emails: { send: sendMock } }; }) }));

import {
  createEmailService,
  humanDuration,
  renderWelcomeEmail,
  renderVerificationEmail,
  renderPasswordResetEmail,
  renderPasswordResetSuccessEmail,
} from "./email";

const WEB = "http://localhost:3000";

beforeEach(() => sendMock.mockClear());

describe("humanDuration", () => {
  it("formats one hour", () => expect(humanDuration(60)).toBe("1 hour"));
  it("formats 24 hours", () => expect(humanDuration(1440)).toBe("24 hours"));
  it("formats plural hours", () => expect(humanDuration(120)).toBe("2 hours"));
  it("falls back to minutes", () => expect(humanDuration(90)).toBe("90 minutes"));
});

describe("welcome template", () => {
  const e = renderWelcomeEmail("Ada", `${WEB}/batches`);
  it("has the welcome subject", () => expect(e.subject).toBe("Welcome to URLPulse"));
  it("greets by name", () => expect(e.html).toContain("Hi Ada,"));
  it("has the dashboard CTA and URL", () => {
    expect(e.html).toContain("Go to Dashboard");
    expect(e.html).toContain(`${WEB}/batches`);
  });
  it("is URLPulse-branded", () => expect(e.html).toContain("URLPulse"));
  it("has a plain-text version with the CTA URL", () => expect(e.text).toContain(`${WEB}/batches`));
});

describe("verification template", () => {
  const e = renderVerificationEmail("Ada", `${WEB}/verify?token=abc`, 1440);
  it("has the verification subject", () => expect(e.subject).toBe("Verify your URLPulse email"));
  it("has the verify heading and CTA", () => {
    expect(e.html).toContain("Verify your email address");
    expect(e.html).toContain("Verify Email Address");
  });
  it("shows the configured expiry (24 hours)", () => expect(e.html).toContain("expire in 24 hours"));
  it("has the safe-to-ignore security note", () =>
    expect(e.html).toContain("didn't create an account"));
});

describe("password reset template", () => {
  const e = renderPasswordResetEmail("Ada", `${WEB}/reset-password?token=abc`, 60);
  it("has the reset subject", () => expect(e.subject).toBe("Reset your URLPulse password"));
  it("has the reset CTA and trusted URL", () => {
    expect(e.html).toContain("Reset Password");
    expect(e.html).toContain(`${WEB}/reset-password?token=abc`);
  });
  it("shows the one-hour expiry", () => expect(e.html).toContain("expire in 1 hour"));
  it("says the password is unchanged if ignored", () =>
    expect(e.html).toContain("password will remain unchanged"));
  it("greets generically when no name is given", () =>
    expect(renderPasswordResetEmail(undefined, WEB, 60).html).toContain("Hi there,"));
});

describe("password reset success template", () => {
  const e = renderPasswordResetSuccessEmail("Ada", `${WEB}/login`);
  it("has the changed-password subject", () =>
    expect(e.subject).toBe("Your URLPulse password was changed"));
  it("has the success heading and sign-in CTA", () => {
    expect(e.html).toContain("Password updated successfully");
    expect(e.html).toContain("Sign In Now");
    expect(e.html).toContain(`${WEB}/login`);
  });
  it("tells the user to contact support if unexpected", () =>
    expect(e.html).toContain("contact our support"));
});

describe("template security", () => {
  it("HTML-escapes a malicious name (no executable markup)", () => {
    const html = renderWelcomeEmail('<img src=x onerror=alert(1)>', WEB).html;
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
  it("escapes quotes in the CTA URL", () => {
    const html = renderPasswordResetEmail("Ada", `${WEB}/r?x="onmouseover="evil`, 60).html;
    expect(html).not.toContain('x="onmouseover="evil');
    expect(html).toContain("&quot;");
  });
});

describe("email service (mocked Resend)", () => {
  const svc = createEmailService("test-key", "URLPulse <no-reply@urlpulse.dev>");

  it("sends with the correct recipient, sender, subject, and URL", async () => {
    await svc.sendVerification({ to: "ada@example.com", name: "Ada", verifyUrl: `${WEB}/v?token=t`, expiresMinutes: 1440 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0]![0];
    expect(arg.to).toBe("ada@example.com");
    expect(arg.from).toBe("URLPulse <no-reply@urlpulse.dev>");
    expect(arg.subject).toBe("Verify your URLPulse email");
    expect(arg.html).toContain(`${WEB}/v?token=t`);
    expect(arg.text).toContain(`${WEB}/v?token=t`);
  });

  it("strips CR/LF from the recipient (no header injection)", async () => {
    await svc.sendWelcome({ to: "ada@example.com\r\nBcc: evil@bad.com", name: "Ada", dashboardUrl: WEB });
    const arg = sendMock.mock.calls[0]![0];
    expect(arg.to).toBe("ada@example.comBcc: evil@bad.com");
    expect(arg.to).not.toContain("\n");
  });

  it("throws (for safe logging by the caller) when Resend reports an error", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(
      svc.sendPasswordReset({ to: "a@example.com", resetUrl: WEB, expiresMinutes: 60 }),
    ).rejects.toThrow("Resend send failed");
  });
});

describe("email service without a provider (dev/test)", () => {
  it("no-ops without throwing and never logs the URL/token", async () => {
    const service = createEmailService(undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(
      service.sendPasswordReset({ to: "u@example.com", resetUrl: `${WEB}/reset?token=SECRET`, expiresMinutes: 60 }),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
    for (const call of info.mock.calls) {
      const line = call.map(String).join(" ");
      expect(line).not.toContain("SECRET");
    }
    info.mockRestore();
  });
});
