import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ------------------------------------------------------------------
// A single controllable stand-in for `resend`'s `resend.emails.send`.
const resendMock = vi.hoisted(() => ({
  send: vi.fn(),
  ctor: vi.fn(),
}));

// Mock the lazily-imported `resend` package. `sendInviteEmail` does
// `const { Resend } = await import("resend"); new Resend(apiKey)` and then
// calls `resend.emails.send(...)`.
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendMock.send };
    constructor(apiKey: string) {
      resendMock.ctor(apiKey);
    }
  },
}));

import { sendInviteEmail } from "@/lib/invites";

const baseParams = {
  email: "invitee@example.com",
  pollTitle: "Team Lunch",
  token: "tok_abc123",
  baseUrl: "https://polls.example.com",
};

// Snapshot & restore the env vars this seam reads.
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  // Default: successful send unless a test overrides it.
  resendMock.send.mockResolvedValue({ data: { id: "email_1" }, error: null });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("sendInviteEmail - console-stub fallback", () => {
  it("logs the stub line and does NOT call Resend when both env vars are unset", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(sendInviteEmail(baseParams)).resolves.toBeUndefined();

    expect(resendMock.ctor).not.toHaveBeenCalled();
    expect(resendMock.send).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logged = infoSpy.mock.calls[0][0] as string;
    expect(logged).toContain("[invite-email:stub]");
    expect(logged).toContain(`to=${baseParams.email}`);
    expect(logged).toContain(
      `link=${baseParams.baseUrl}/polls/invite/${baseParams.token}`
    );
  });

  it("falls back to the stub when only RESEND_API_KEY is set (EMAIL_FROM missing)", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await sendInviteEmail(baseParams);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(resendMock.send).not.toHaveBeenCalled();
  });

  it("falls back to the stub when only EMAIL_FROM is set (RESEND_API_KEY missing)", async () => {
    process.env.EMAIL_FROM = "polls@example.com";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await sendInviteEmail(baseParams);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(resendMock.send).not.toHaveBeenCalled();
  });

  it("never logs the API key in the stub path", async () => {
    process.env.RESEND_API_KEY = "re_super_secret";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await sendInviteEmail(baseParams);

    const logged = infoSpy.mock.calls[0][0] as string;
    expect(logged).not.toContain("re_super_secret");
  });
});

describe("sendInviteEmail - Resend delivery (both env vars set)", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Polls <polls@example.com>";
  });

  it("constructs the Resend client with the API key and sends the email", async () => {
    await expect(sendInviteEmail(baseParams)).resolves.toBeUndefined();

    expect(resendMock.ctor).toHaveBeenCalledWith("re_test_key");
    expect(resendMock.send).toHaveBeenCalledTimes(1);

    const payload = resendMock.send.mock.calls[0][0];
    expect(payload).toMatchObject({
      from: "Polls <polls@example.com>",
      to: baseParams.email,
    });
    expect(payload.subject).toContain(baseParams.pollTitle);
    // Body carries the invite link built from baseUrl + token.
    const link = `${baseParams.baseUrl}/polls/invite/${baseParams.token}`;
    expect(payload.html).toContain(link);
    expect(payload.text).toContain(link);
  });

  it("HTML-escapes a user-supplied poll title in the HTML body", async () => {
    await sendInviteEmail({
      ...baseParams,
      pollTitle: '<script>alert("x")</script>',
    });

    const payload = resendMock.send.mock.calls[0][0];
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).toContain("&lt;script&gt;");
  });

  it("does not call the stub logger when a real send occurs", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await sendInviteEmail(baseParams);

    expect(infoSpy).not.toHaveBeenCalled();
    expect(resendMock.send).toHaveBeenCalledTimes(1);
  });
});

describe("sendInviteEmail - graceful failure handling", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "polls@example.com";
  });

  it("does NOT throw when Resend returns an error object, and logs the message", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    resendMock.send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "domain not verified" },
    });

    await expect(sendInviteEmail(baseParams)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0][0] as string;
    expect(logged).toContain("Resend rejected send");
    expect(logged).toContain("domain not verified");
  });

  it("does NOT throw when the Resend client throws (e.g. network failure)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    resendMock.send.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(sendInviteEmail(baseParams)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    // The message is logged, not the raw secret/env.
    const args = errorSpy.mock.calls[0];
    expect(JSON.stringify(args)).toContain("ECONNREFUSED");
    expect(JSON.stringify(args)).not.toContain("re_test_key");
  });

  it("never leaks the API key when a send throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    resendMock.send.mockRejectedValue(new Error("boom"));

    await sendInviteEmail(baseParams);

    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("re_test_key");
  });
});
