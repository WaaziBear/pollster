import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ------------------------------------------------------------------
const guardsMock = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  canAccessPoll: vi.fn(),
}));

const txMock = vi.hoisted(() => ({
  response: { upsert: vi.fn() },
  answer: { deleteMany: vi.fn(), create: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  poll: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => guardsMock);
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { submitResponseAction } from "@/actions/response.actions";

const user = { id: "user-invitee", email: "invitee@example.com" };

// A poll containing one question of every supported type.
function buildPoll(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "poll1",
    isPublished: true,
    creatorId: "user-owner",
    questions: [
      {
        id: "q-single",
        type: "SINGLE_CHOICE",
        required: false,
        config: null,
        options: [{ id: "o1" }, { id: "o2" }],
      },
      {
        id: "q-multi",
        type: "MULTI_CHOICE",
        required: false,
        config: { maxSelections: 2 },
        options: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
      },
      {
        id: "q-text",
        type: "FREE_TEXT",
        required: false,
        config: { maxLength: 10 },
        options: [],
      },
      {
        id: "q-rating",
        type: "RATING",
        required: false,
        config: { min: 1, max: 5 },
        options: [],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  guardsMock.getSessionUser.mockResolvedValue(user);
  guardsMock.canAccessPoll.mockResolvedValue({ allowed: true, isOwner: false });
  prismaMock.poll.findUnique.mockResolvedValue(buildPoll());
  txMock.response.upsert.mockResolvedValue({ id: "resp1" });
  txMock.answer.deleteMany.mockResolvedValue({ count: 0 });
  txMock.answer.create.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(txMock)
  );
});

describe("submitResponseAction - authentication & authorization", () => {
  it("fails when the user is not signed in", async () => {
    guardsMock.getSessionUser.mockResolvedValue(null);
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-text", textValue: "hi" }],
    });
    expect(res.ok).toBe(false);
  });

  it("BLOCKS a non-invited user from answering", async () => {
    guardsMock.canAccessPoll.mockResolvedValue({ allowed: false, isOwner: false });
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-text", textValue: "hi" }],
    });
    expect(res).toMatchObject({ ok: false, error: "Not authorized to answer this poll." });
    // Must not attempt to persist anything.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("prevents answering an unpublished poll when not the owner", async () => {
    prismaMock.poll.findUnique.mockResolvedValue(
      buildPoll({ isPublished: false })
    );
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-text", textValue: "hi" }],
    });
    expect(res.ok).toBe(false);
  });
});

describe("submitResponseAction - server-side answer validation", () => {
  it("persists a valid submission across all question types", async () => {
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [
        { questionId: "q-single", selectedOptionIds: ["o1"] },
        { questionId: "q-multi", selectedOptionIds: ["m1", "m2"] },
        { questionId: "q-text", textValue: "hello" },
        { questionId: "q-rating", numberValue: 4 },
      ],
    });
    expect(res.ok).toBe(true);
    // One answer.create per answered question.
    expect(txMock.answer.create).toHaveBeenCalledTimes(4);
  });

  it("rejects a single-choice answer with more than one selection", async () => {
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-single", selectedOptionIds: ["o1", "o2"] }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.["q-single"]).toBeTruthy();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an option id that does not belong to the question", async () => {
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-single", selectedOptionIds: ["not-a-real-option"] }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.["q-single"]).toBeTruthy();
  });

  it("rejects a multi-choice answer exceeding maxSelections", async () => {
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-multi", selectedOptionIds: ["m1", "m2", "m3"] }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.["q-multi"]).toBeTruthy();
  });

  it("rejects free-text longer than the configured maxLength", async () => {
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-text", textValue: "way too long for the limit" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.["q-text"]).toBeTruthy();
  });

  it("rejects a rating outside the configured range", async () => {
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-rating", numberValue: 99 }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.["q-rating"]).toBeTruthy();
  });

  it("enforces required questions when left empty", async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: "poll1",
      isPublished: true,
      creatorId: "user-owner",
      questions: [
        { id: "q-req", type: "FREE_TEXT", required: true, config: null, options: [] },
      ],
    });
    const res = await submitResponseAction({
      pollId: "poll1",
      answers: [{ questionId: "q-req", textValue: "" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.["q-req"]).toBeTruthy();
  });
});
