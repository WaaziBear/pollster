import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  poll: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  response: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getResults, getSharedPolls, getPollForRespondent } from "@/lib/queries/polls";

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

  it("emits rankedChoice with count + averageRank for ranked MULTI_CHOICE", async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: "poll1",
      title: "Results",
      description: null,
      _count: { responses: 2 },
      questions: [
        {
          id: "q-ranked",
          prompt: "Rank",
          type: "MULTI_CHOICE",
          required: false,
          order: 0,
          config: { ranked: true },
          options: [
            {
              id: "ro1",
              label: "X",
              order: 0,
              _count: { answerLinks: 2 },
              answerLinks: [{ rank: 1 }, { rank: 2 }],
            },
            {
              id: "ro2",
              label: "Y",
              order: 1,
              _count: { answerLinks: 1 },
              answerLinks: [{ rank: 1 }],
            },
          ],
          answers: [],
        },
      ],
    });

    const res = await getResults("poll1");
    if (!res) return;
    const rc = res.questions[0] as Extract<
      (typeof res.questions)[number],
      { kind: "rankedChoice" }
    >;
    expect(rc.kind).toBe("rankedChoice");
    expect(rc.options).toEqual([
      { id: "ro1", label: "X", count: 2, averageRank: 1.5 },
      { id: "ro2", label: "Y", count: 1, averageRank: 1 },
    ]);
  });

  it("keeps unranked MULTI_CHOICE as choice bars (backward compatible)", async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: "poll1",
      title: "Results",
      description: null,
      _count: { responses: 1 },
      questions: [
        {
          id: "q-multi",
          prompt: "Pick many",
          type: "MULTI_CHOICE",
          required: false,
          order: 0,
          config: null,
          options: [
            { id: "o1", label: "A", order: 0, _count: { answerLinks: 1 }, answerLinks: [{ rank: null }] },
            { id: "o2", label: "B", order: 1, _count: { answerLinks: 1 }, answerLinks: [{ rank: null }] },
          ],
          answers: [],
        },
      ],
    });

    const res = await getResults("poll1");
    if (!res) return;
    expect(res.questions[0].kind).toBe("choice");
  });
});

describe("getPollForRespondent prefill ordering", () => {
  it("loads existing selected options ordered by rank asc", async () => {
    prismaMock.poll.findFirst.mockResolvedValue({
      id: "poll1",
      creatorId: "owner",
      isPublished: true,
      questions: [],
      creator: { email: "o@e.com", name: null },
    });
    prismaMock.response.findUnique.mockResolvedValue({
      id: "resp1",
      answers: [],
    });

    await getPollForRespondent("poll1", { id: "u1", email: "u1@e.com" });

    const arg = prismaMock.response.findUnique.mock.calls[0][0];
    expect(arg.include.answers.include.selectedOptions.orderBy).toEqual({
      rank: "asc",
    });
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
