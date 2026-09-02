import { describe, it, expect, vi, beforeEach } from "vitest";

// next-auth's real entrypoint pulls in `next/server`, which does not resolve
// under the vitest/jsdom runtime. We only need its AuthError export here, and
// mocking it ensures the action and the test share the same AuthError class
// so `err instanceof AuthError` matches.
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type: string;
    constructor(type: string) {
      super(type);
      this.type = type;
      this.name = "AuthError";
    }
  },
}));

import { AuthError } from "next-auth";

const authMock = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn() },
}));
const invitesMock = vi.hoisted(() => ({
  linkInvitesToUser: vi.fn(),
  linkGrantsToUser: vi.fn(),
}));

vi.mock("@/auth", () => authMock);
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/invites", () => invitesMock);

import { signupAction, loginAction } from "@/actions/auth.actions";
import { verifyPassword } from "@/lib/hash";

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

// Unique email per test to avoid the in-memory rate limiter carrying across cases.
let counter = 0;
const uniqueEmail = () => `user${counter++}@example.com`;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.user.create.mockImplementation(async ({ data }: { data: { email: string } }) => ({
    id: "new-user",
    ...data,
  }));
  invitesMock.linkInvitesToUser.mockResolvedValue(0);
  invitesMock.linkGrantsToUser.mockResolvedValue(0);
  authMock.signIn.mockResolvedValue(undefined);
});

describe("signupAction", () => {
  it("rejects invalid input without creating a user", async () => {
    const res = await signupAction(undefined, fd({ email: "bad", password: "short" }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fieldErrors?.email).toBeTruthy();
      expect(res.fieldErrors?.password).toBeTruthy();
    }
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });
    const res = await signupAction(
      undefined,
      fd({ email: uniqueEmail(), password: "password1" })
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.email).toBeTruthy();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("hashes the password (never stores plaintext) and creates the user", async () => {
    const email = uniqueEmail();
    const res = await signupAction(undefined, fd({ email, password: "password1" }));
    expect(res.ok).toBe(true);

    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    const created = prismaMock.user.create.mock.calls[0][0].data;
    expect(created.email).toBe(email);
    expect(created.passwordHash).toBeDefined();
    expect(created.passwordHash).not.toBe("password1");
    // The stored hash must verify against the original password.
    await expect(verifyPassword("password1", created.passwordHash)).resolves.toBe(true);
  });

  it("normalizes the email before storage", async () => {
    await signupAction(undefined, fd({ email: "MixedCase@Example.COM", password: "password1" }));
    const created = prismaMock.user.create.mock.calls[0][0].data;
    expect(created.email).toBe("mixedcase@example.com");
  });

  it("links pending invites and establishes a session on success", async () => {
    const email = uniqueEmail();
    await signupAction(undefined, fd({ email, password: "password1" }));
    expect(invitesMock.linkInvitesToUser).toHaveBeenCalledWith(email, "new-user");
    expect(authMock.signIn).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ email, redirect: false })
    );
  });
});

describe("loginAction", () => {
  it("rejects invalid input", async () => {
    const res = await loginAction(undefined, fd({ email: "bad", password: "" }));
    expect(res.ok).toBe(false);
    expect(authMock.signIn).not.toHaveBeenCalled();
  });

  it("succeeds with valid credentials", async () => {
    const res = await loginAction(undefined, fd({ email: uniqueEmail(), password: "whatever" }));
    expect(res.ok).toBe(true);
    expect(authMock.signIn).toHaveBeenCalled();
  });

  it("returns a generic error when auth fails (no user enumeration)", async () => {
    authMock.signIn.mockRejectedValue(new AuthError("CredentialsSignin"));
    const res = await loginAction(undefined, fd({ email: uniqueEmail(), password: "whatever" }));
    expect(res).toMatchObject({ ok: false, error: "Invalid email or password." });
  });
});
