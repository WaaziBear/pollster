import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ------------------------------------------------------------------
const prismaMock = vi.hoisted(() => ({
  poll: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => ({ auth: vi.fn() }));
const redirectMock = vi.hoisted(() => vi.fn(() => {
  throw new Error("REDIRECT");
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/auth", () => ({ auth: authMock.auth }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import {
  canAccessPoll,
  requirePollOwner,
  requireInvitee,
  requireUser,
  getSessionUser,
  AuthorizationError,
} from "@/lib/auth-guards";

const owner = { id: "user-owner", email: "owner@example.com" };
const invitee = { id: "user-invitee", email: "invitee@example.com" };
const outsider = { id: "user-outsider", email: "outsider@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canAccessPoll", () => {
  it("builds an authorization-scoped query (owner OR non-revoked invite)", async () => {
    prismaMock.poll.findFirst.mockResolvedValue({ id: "poll1", creatorId: owner.id });
    await canAccessPoll("poll1", invitee);

    const arg = prismaMock.poll.findFirst.mock.calls[0][0];
    expect(arg.where.id).toBe("poll1");
    // The query must constrain access to creator OR a matching non-revoked invite.
    expect(arg.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ creatorId: invitee.id }),
        expect.objectContaining({
          isPublished: true,
          invites: {
            some: expect.objectContaining({
              status: { not: "REVOKED" },
              OR: expect.arrayContaining([
                { userId: invitee.id },
                { email: invitee.email },
              ]),
            }),
          },
        }),
      ])
    );
  });

  it("returns allowed+isOwner when the DB returns the poll owned by the user", async () => {
    prismaMock.poll.findFirst.mockResolvedValue({ id: "poll1", creatorId: owner.id });
    await expect(canAccessPoll("poll1", owner)).resolves.toEqual({
      allowed: true,
      isOwner: true,
    });
  });

  it("returns allowed but not owner for an invited non-creator", async () => {
    prismaMock.poll.findFirst.mockResolvedValue({ id: "poll1", creatorId: owner.id });
    await expect(canAccessPoll("poll1", invitee)).resolves.toEqual({
      allowed: true,
      isOwner: false,
    });
  });

  it("BLOCKS a non-invited outsider (DB query returns null)", async () => {
    prismaMock.poll.findFirst.mockResolvedValue(null);
    await expect(canAccessPoll("poll1", outsider)).resolves.toEqual({
      allowed: false,
      isOwner: false,
    });
  });
});

describe("requireInvitee", () => {
  it("throws AuthorizationError for an outsider", async () => {
    prismaMock.poll.findFirst.mockResolvedValue(null);
    await expect(requireInvitee("poll1", outsider)).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("does not throw for an allowed user", async () => {
    prismaMock.poll.findFirst.mockResolvedValue({ id: "poll1", creatorId: owner.id });
    await expect(requireInvitee("poll1", invitee)).resolves.toBeUndefined();
  });
});

describe("requirePollOwner", () => {
  it("returns the poll when the user is the creator", async () => {
    const poll = { id: "poll1", creatorId: owner.id, title: "T" };
    prismaMock.poll.findUnique.mockResolvedValue(poll);
    await expect(requirePollOwner("poll1", owner)).resolves.toBe(poll);
  });

  it("throws AuthorizationError when the user is not the creator", async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ id: "poll1", creatorId: owner.id });
    await expect(requirePollOwner("poll1", outsider)).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("throws AuthorizationError when the poll does not exist", async () => {
    prismaMock.poll.findUnique.mockResolvedValue(null);
    await expect(requirePollOwner("missing", owner)).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });
});

describe("session helpers", () => {
  it("getSessionUser returns null when unauthenticated", async () => {
    authMock.auth.mockResolvedValue(null);
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("getSessionUser normalizes the email", async () => {
    authMock.auth.mockResolvedValue({
      user: { id: "u1", email: "MixedCase@Example.COM" },
    });
    await expect(getSessionUser()).resolves.toEqual({
      id: "u1",
      email: "mixedcase@example.com",
      name: undefined,
    });
  });

  it("requireUser redirects to /login when unauthenticated", async () => {
    authMock.auth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
