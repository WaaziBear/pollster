import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  poll: { findUnique: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getResults, getSharedPolls } from "@/lib/queries/polls";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getResults aggregation", () => {
  it("returns null for a missing poll", async () => {
    prismaMock.poll.findUnique.mockResolvedValue(null);
    await expect(getResults("missing")).resolves.toBeNull();
  });

  it("aggregates choice, rating and free-text questions correctly", async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: "poll1",
      title: "Results",
      description: null,
      _count: { responses: 3 },
      questions: [
        {
          id: "q-choice",
          prompt: "Pick",
          type: "SINGLE_CHOICE",
          required: false,
          order: 0,
          options: [
            { id: "o1", label: "A", order: 0, _count: { answerLinks: 2 } },
            { id: "o2", label: "B", order: 1, _count: { answerLinks: 1 } },
          ],
          answers: [],
        },
        {
          id: "q-rating",
          prompt: "Rate",
          type: "RATING",
          required: false,
          order: 1,
          options: [],
          answers: [
            { textValue: null, numberValue: 4 },
            { textValue: null, numberValue: 2 },
            { textValue: null, numberValue: 4 },
          ],
        },
        {
          id: "q-text",
          prompt: "Comment",
          type: "FREE_TEXT",
          required: false,
          order: 2,
          options: [],
          answers: [
            { textValue: "great", numberValue: null },
            { textValue: "  ", numberValue: null },
            { textValue: null, numberValue: null },
          ],
        },
      ],
    });

    const res = await getResults("poll1");
    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.responseCount).toBe(3);

    const choice = res.questions[0] as Extract<(typeof res.questions)[number], { kind: "choice" }>;
    expect(choice.kind).toBe("choice");
    expect(choice.total).toBe(3);
    expect(choice.options.map((o) => o.count)).toEqual([2, 1]);

    const rating = res.questions[1] as Extract<(typeof res.questions)[number], { kind: "rating" }>;
    expect(rating.kind).toBe("rating");
    expect(rating.count).toBe(3);
    expect(rating.average).toBeCloseTo((4 + 2 + 4) / 3);
    expect(rating.distribution).toEqual({ 4: 2, 2: 1 });

    const text = res.questions[2] as Extract<(typeof res.questions)[number], { kind: "text" }>;
    expect(text.kind).toBe("text");
    // blank / null text answers are filtered out
    expect(text.texts).toEqual(["great"]);
  });
});

describe("getSharedPolls query", () => {
  it("scopes to published polls not created by the user, matched by a non-revoked invite", async () => {
    prismaMock.poll.findMany.mockResolvedValue([]);
    await getSharedPolls("user1", "user1@example.com");

    const arg = prismaMock.poll.findMany.mock.calls[0][0];
    expect(arg.where.isPublished).toBe(true);
    expect(arg.where.creatorId).toEqual({ not: "user1" });
    expect(arg.where.invites.some.status).toEqual({ not: "REVOKED" });
    expect(arg.where.invites.some.OR).toEqual(
      expect.arrayContaining([{ userId: "user1" }, { email: "user1@example.com" }])
    );
  });

  it("maps hasResponded from the presence of the user's response", async () => {
    prismaMock.poll.findMany.mockResolvedValue([
      { id: "p1", responses: [{ id: "r1" }] },
      { id: "p2", responses: [] },
    ]);
    const res = await getSharedPolls("user1", "user1@example.com");
    expect(res[0].hasResponded).toBe(true);
    expect(res[1].hasResponded).toBe(false);
  });
});
