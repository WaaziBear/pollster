import { describe, it, expect, vi, beforeEach } from "vitest";

const guardsMock = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  requirePollOwner: vi.fn(),
}));

const txMock = vi.hoisted(() => ({
  poll: { create: vi.fn(), update: vi.fn() },
  question: { create: vi.fn(), deleteMany: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock("@/lib/auth-guards", () => ({
  getSessionUser: guardsMock.getSessionUser,
  requirePollOwner: guardsMock.requirePollOwner,
  AuthorizationError: class AuthorizationError extends Error {},
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createPollAction } from "@/actions/poll.actions";

const user = { id: "user-owner", email: "owner@example.com" };

const validPoll = {
  title: "Survey",
  description: "desc",
  isPublished: true,
  questions: [
    { type: "SINGLE_CHOICE" as const, prompt: "One?", required: false, options: [{ label: "A" }, { label: "B" }] },
    { type: "MULTI_CHOICE" as const, prompt: "Many?", required: true, options: [{ label: "X" }, { label: "Y" }], config: { maxSelections: 2 } },
    { type: "FREE_TEXT" as const, prompt: "Text?", required: false, options: [], config: { maxLength: 500 } },
    { type: "RATING" as const, prompt: "Rate?", required: false, options: [], config: { min: 1, max: 5 } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  guardsMock.getSessionUser.mockResolvedValue(user);
  txMock.poll.create.mockResolvedValue({ id: "poll1" });
  txMock.question.create.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(txMock)
  );
});

describe("createPollAction", () => {
  it("fails when not signed in", async () => {
    guardsMock.getSessionUser.mockResolvedValue(null);
    const res = await createPollAction(validPoll);
    expect(res.ok).toBe(false);
  });

  it("rejects invalid poll input (no questions)", async () => {
    const res = await createPollAction({ ...validPoll, questions: [] });
    expect(res.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("persists the poll with the creator id and returns the new id", async () => {
    const res = await createPollAction(validPoll);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.pollId).toBe("poll1");
    expect(txMock.poll.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Survey", creatorId: user.id }),
      })
    );
  });

  it("creates one question row per question, preserving type and order", async () => {
    await createPollAction(validPoll);
    expect(txMock.question.create).toHaveBeenCalledTimes(4);

    const types = txMock.question.create.mock.calls.map((c) => c[0].data.type);
    expect(types).toEqual(["SINGLE_CHOICE", "MULTI_CHOICE", "FREE_TEXT", "RATING"]);

    const orders = txMock.question.create.mock.calls.map((c) => c[0].data.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("creates nested options only for choice questions", async () => {
    await createPollAction(validPoll);
    const byType = new Map(
      txMock.question.create.mock.calls.map((c) => [c[0].data.type, c[0].data])
    );
    // choice types include nested option creates
    expect(byType.get("SINGLE_CHOICE").options.create).toHaveLength(2);
    expect(byType.get("MULTI_CHOICE").options.create).toHaveLength(2);
    // non-choice types do not create options
    expect(byType.get("FREE_TEXT").options).toBeUndefined();
    expect(byType.get("RATING").options).toBeUndefined();
  });

  it("persists per-type config for rating and multi-choice", async () => {
    await createPollAction(validPoll);
    const byType = new Map(
      txMock.question.create.mock.calls.map((c) => [c[0].data.type, c[0].data])
    );
    expect(byType.get("RATING").config).toEqual({ min: 1, max: 5 });
    expect(byType.get("MULTI_CHOICE").config).toEqual({ maxSelections: 2 });
  });
});
