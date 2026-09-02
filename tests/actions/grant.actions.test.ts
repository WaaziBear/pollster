import { describe, it, expect, vi, beforeEach } from "vitest";

const guardsMock = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  requirePollOwner: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  pollAccess: { upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/auth-guards", () => ({
  getSessionUser: guardsMock.getSessionUser,
  requirePollOwner: guardsMock.requirePollOwner,
  AuthorizationError: class AuthorizationError extends Error {},
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { grantAccessAction, revokeAccessAction } from "@/actions/grant.actions";

const owner = { id: "owner", email: "owner@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  guardsMock.getSessionUser.mockResolvedValue(owner);
  guardsMock.requirePollOwner.mockResolvedValue({ id: "poll1", creatorId: owner.id });
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.pollAccess.upsert.mockResolvedValue({ id: "grant1" });
});

describe("grantAccessAction", () => {
  it("fails when not signed in", async () => {
    guardsMock.getSessionUser.mockResolvedValue(null);
    const res = await grantAccessAction("poll1", ["a@e.com"], "EDITOR");
    expect(res.ok).toBe(false);
    expect(prismaMock.pollAccess.upsert).not.toHaveBeenCalled();
  });

  it("is OWNER-ONLY: a non-owner is denied and nothing is written", async () => {
    const { AuthorizationError } = await import("@/lib/auth-guards");
    guardsMock.requirePollOwner.mockRejectedValueOnce(new AuthorizationError("nope"));
    const res = await grantAccessAction("poll1", ["a@e.com"], "EDITOR");
    expect(res.ok).toBe(false);
    expect(prismaMock.pollAccess.upsert).not.toHaveBeenCalled();
  });

  it("DENIES an EDITOR (no privilege escalation): grant is owner-gated, nothing written", async () => {
    // grantAccessAction is gated on requirePollOwner. An EDITOR is a non-creator,
    // so the owner guard rejects them — an editor can never grant/escalate access.
    const { AuthorizationError } = await import("@/lib/auth-guards");
    guardsMock.requirePollOwner.mockRejectedValueOnce(new AuthorizationError("editor"));
    const res = await grantAccessAction("poll1", ["a@e.com"], "EDITOR");
    expect(res.ok).toBe(false);
    expect(prismaMock.pollAccess.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid role", async () => {
    // @ts-expect-error deliberately invalid role at the boundary
    const res = await grantAccessAction("poll1", ["a@e.com"], "SUPERUSER");
    expect(res.ok).toBe(false);
    expect(prismaMock.pollAccess.upsert).not.toHaveBeenCalled();
  });

  it("normalizes + de-dupes emails and upserts one grant each with the role", async () => {
    const res = await grantAccessAction(
      "poll1",
      ["A@E.com", "  a@e.com ", "b@e.com"],
      "RESULTS_VIEWER"
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.granted).toBe(2);
    expect(prismaMock.pollAccess.upsert).toHaveBeenCalledTimes(2);

    const firstCall = prismaMock.pollAccess.upsert.mock.calls[0][0];
    expect(firstCall.where).toEqual({ pollId_email: { pollId: "poll1", email: "a@e.com" } });
    expect(firstCall.create).toMatchObject({ pollId: "poll1", email: "a@e.com", role: "RESULTS_VIEWER" });
    expect(firstCall.update).toMatchObject({ role: "RESULTS_VIEWER" });
  });

  it("links userId when the email already owns an account", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u-b", email: "b@e.com" }]);
    await grantAccessAction("poll1", ["a@e.com", "b@e.com"], "EDITOR");

    const calls = prismaMock.pollAccess.upsert.mock.calls.map((c) => c[0]);
    const aCall = calls.find((c) => c.where.pollId_email.email === "a@e.com")!;
    const bCall = calls.find((c) => c.where.pollId_email.email === "b@e.com")!;
    expect(aCall.create.userId).toBeNull();
    expect(bCall.create.userId).toBe("u-b");
    expect(bCall.update.userId).toBe("u-b");
  });
});

describe("revokeAccessAction", () => {
  it("verifies poll ownership before deleting the grant", async () => {
    prismaMock.pollAccess.findUnique.mockResolvedValue({ id: "grant1", pollId: "poll1" });
    const res = await revokeAccessAction("grant1");
    expect(res.ok).toBe(true);
    expect(guardsMock.requirePollOwner).toHaveBeenCalledWith("poll1", owner);
    expect(prismaMock.pollAccess.delete).toHaveBeenCalledWith({ where: { id: "grant1" } });
  });

  it("denies revoke when the caller does not own the grant's poll (no delete)", async () => {
    const { AuthorizationError } = await import("@/lib/auth-guards");
    prismaMock.pollAccess.findUnique.mockResolvedValue({ id: "grant1", pollId: "poll1" });
    guardsMock.requirePollOwner.mockRejectedValueOnce(new AuthorizationError("nope"));
    const res = await revokeAccessAction("grant1");
    expect(res.ok).toBe(false);
    expect(prismaMock.pollAccess.delete).not.toHaveBeenCalled();
  });

  it("DENIES an EDITOR (no privilege escalation): revoke is owner-gated, no delete", async () => {
    const { AuthorizationError } = await import("@/lib/auth-guards");
    prismaMock.pollAccess.findUnique.mockResolvedValue({ id: "grant1", pollId: "poll1" });
    guardsMock.requirePollOwner.mockRejectedValueOnce(new AuthorizationError("editor"));
    const res = await revokeAccessAction("grant1");
    expect(res.ok).toBe(false);
    expect(prismaMock.pollAccess.delete).not.toHaveBeenCalled();
  });

  it("fails cleanly when the grant does not exist", async () => {
    prismaMock.pollAccess.findUnique.mockResolvedValue(null);
    const res = await revokeAccessAction("missing");
    expect(res.ok).toBe(false);
    expect(prismaMock.pollAccess.delete).not.toHaveBeenCalled();
  });
});
