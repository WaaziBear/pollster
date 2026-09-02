import { describe, it, expect, vi, beforeEach } from "vitest";

const guardsMock = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  requirePollOwner: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  poll: { create: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/auth-guards", () => ({
  getSessionUser: guardsMock.getSessionUser,
  requirePollOwner: guardsMock.requirePollOwner,
  AuthorizationError: class AuthorizationError extends Error {},
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createPollAction, updatePollAction } from "@/actions/poll.actions";

const user = { id: "user-owner", email: "owner@example.com" };

const validPoll = {
  title: "Survey",
  description: "desc",
  isPublished: true,
  commentVisibility: "EDITORS" as const,
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
  prismaMock.poll.create.mockResolvedValue({ id: "poll1" });
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
    expect(prismaMock.poll.create).not.toHaveBeenCalled();
  });

  it("persists the poll with the creator id and returns the new id", async () => {
    const res = await createPollAction(validPoll);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.pollId).toBe("poll1");
    expect(prismaMock.poll.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Survey", creatorId: user.id }),
      })
    );
  });

  it("creates one question row per question, preserving type and order", async () => {
    await createPollAction(validPoll);
    expect(prismaMock.poll.create).toHaveBeenCalledTimes(1);

    const questions = prismaMock.poll.create.mock.calls[0][0].data.questions.create;
    expect(questions).toHaveLength(4);

    const types = questions.map((q: { type: string }) => q.type);
    expect(types).toEqual(["SINGLE_CHOICE", "MULTI_CHOICE", "FREE_TEXT", "RATING"]);

    const orders = questions.map((q: { order: number }) => q.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("creates nested options only for choice questions", async () => {
    await createPollAction(validPoll);
    const questions = prismaMock.poll.create.mock.calls[0][0].data.questions.create;
    const byType = new Map(questions.map((q: { type: string }) => [q.type, q]));
    // choice types include nested option creates
    expect((byType.get("SINGLE_CHOICE") as { options: { create: unknown[] } }).options.create).toHaveLength(2);
    expect((byType.get("MULTI_CHOICE") as { options: { create: unknown[] } }).options.create).toHaveLength(2);
    // non-choice types do not create options
    expect((byType.get("FREE_TEXT") as { options?: unknown }).options).toBeUndefined();
    expect((byType.get("RATING") as { options?: unknown }).options).toBeUndefined();
  });

  it("persists per-type config for rating and multi-choice", async () => {
    await createPollAction(validPoll);
    const questions = prismaMock.poll.create.mock.calls[0][0].data.questions.create;
    const byType = new Map(questions.map((q: { type: string }) => [q.type, q]));
    expect((byType.get("RATING") as { config: unknown }).config).toEqual({ min: 1, max: 5 });
    expect((byType.get("MULTI_CHOICE") as { config: unknown }).config).toEqual({ maxSelections: 2 });
  });

  it("persists the selected commentVisibility on create", async () => {
    const res = await createPollAction({ ...validPoll, commentVisibility: "EVERYONE" });
    expect(res.ok).toBe(true);
    expect(prismaMock.poll.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ commentVisibility: "EVERYONE" }),
      })
    );
  });

  it("defaults commentVisibility to EDITORS on create when omitted", async () => {
    // Omit commentVisibility entirely; pollSchema default should apply.
    const { commentVisibility: _omit, ...noVisibility } = validPoll;
    void _omit;
    const res = await createPollAction(noVisibility as typeof validPoll);
    expect(res.ok).toBe(true);
    expect(prismaMock.poll.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ commentVisibility: "EDITORS" }),
      })
    );
  });

  it("persists config.ranked=true for a ranked multi-choice question", async () => {
    const rankedPoll = {
      title: "Ranked survey",
      description: "",
      isPublished: true,
      commentVisibility: "EDITORS" as const,
      questions: [
        {
          type: "MULTI_CHOICE" as const,
          prompt: "Rank these",
          required: false,
          options: [{ label: "A" }, { label: "B" }, { label: "C" }],
          config: { maxSelections: 3, ranked: true },
        },
      ],
    };
    const res = await createPollAction(rankedPoll);
    expect(res.ok).toBe(true);
    const questions = prismaMock.poll.create.mock.calls[0][0].data.questions.create;
    expect(questions[0].config).toEqual({ maxSelections: 3, ranked: true });
  });
});

describe("updatePollAction", () => {
  beforeEach(() => {
    prismaMock.poll.update.mockResolvedValue({ id: "poll1" });
  });

  it("persists config.ranked=true through the nested replace write", async () => {
    const rankedPoll = {
      title: "Ranked survey",
      description: "",
      isPublished: true,
      commentVisibility: "EDITORS" as const,
      questions: [
        {
          type: "MULTI_CHOICE" as const,
          prompt: "Rank these",
          required: false,
          options: [{ label: "A" }, { label: "B" }, { label: "C" }],
          config: { maxSelections: 3, ranked: true },
        },
      ],
    };
    const res = await updatePollAction("poll1", rankedPoll);
    expect(res.ok).toBe(true);
    expect(prismaMock.poll.update).toHaveBeenCalledTimes(1);

    const arg = prismaMock.poll.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "poll1" });
    // Wholesale replace: old questions removed, new ones created in one write.
    expect(arg.data.questions.deleteMany).toEqual({});
    const questions = arg.data.questions.create;
    expect(questions[0].config).toEqual({ maxSelections: 3, ranked: true });
  });

  it("toggling ranked OFF persists config without ranked (unranked multi-choice)", async () => {
    const unrankedPoll = {
      title: "Plain survey",
      description: "",
      isPublished: true,
      commentVisibility: "EDITORS" as const,
      questions: [
        {
          type: "MULTI_CHOICE" as const,
          prompt: "Pick many",
          required: false,
          options: [{ label: "A" }, { label: "B" }],
          config: { maxSelections: 2 },
        },
      ],
    };
    const res = await updatePollAction("poll1", unrankedPoll);
    expect(res.ok).toBe(true);
    const questions = prismaMock.poll.update.mock.calls[0][0].data.questions.create;
    expect(questions[0].config).toEqual({ maxSelections: 2 });
    expect((questions[0].config as Record<string, unknown>).ranked).toBeUndefined();
  });

  it("persists the updated commentVisibility through the nested replace write", async () => {
    const res = await updatePollAction("poll1", { ...validPoll, commentVisibility: "ANONYMOUS" });
    expect(res.ok).toBe(true);
    expect(prismaMock.poll.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "poll1" },
        data: expect.objectContaining({ commentVisibility: "ANONYMOUS" }),
      })
    );
  });

  it("blocks a non-owner from updating", async () => {    const { AuthorizationError } = await import("@/lib/auth-guards");
    guardsMock.requirePollOwner.mockRejectedValueOnce(new AuthorizationError("nope"));
    const res = await updatePollAction("poll1", validPoll);
    expect(res.ok).toBe(false);
    expect(prismaMock.poll.update).not.toHaveBeenCalled();
  });
});
