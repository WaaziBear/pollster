import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  poll: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
// getResponsesForExport -> requirePollOwner pulls @/auth + next/navigation into
// the module graph; stub them so the module loads under vitest. The real
// ownership logic (requirePollOwner) still runs against the mocked prisma.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { getResponsesForExport } from "@/lib/queries/polls";
import { AuthorizationError } from "@/lib/auth-guards";

const owner = { id: "owner", email: "owner@example.com" };
const outsider = { id: "outsider", email: "out@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getResponsesForExport owner-gating", () => {
  it("throws AuthorizationError for a non-owner and never queries response data", async () => {
    // requirePollOwner's ownership lookup returns a poll owned by someone else.
    prismaMock.poll.findUnique.mockResolvedValueOnce({
      id: "poll1",
      creatorId: owner.id,
    });

    await expect(getResponsesForExport("poll1", outsider)).rejects.toBeInstanceOf(
      AuthorizationError
    );
    // Only the ownership check ran; the data query was never reached.
    expect(prismaMock.poll.findUnique).toHaveBeenCalledTimes(1);
  });

  it("throws AuthorizationError when the poll does not exist", async () => {
    prismaMock.poll.findUnique.mockResolvedValueOnce(null);
    await expect(getResponsesForExport("missing", owner)).rejects.toBeInstanceOf(
      AuthorizationError
    );
    expect(prismaMock.poll.findUnique).toHaveBeenCalledTimes(1);
  });

  it("returns the poll + ordered questions + responses for the owner", async () => {
    prismaMock.poll.findUnique
      // 1) ownership check inside requirePollOwner
      .mockResolvedValueOnce({ id: "poll1", creatorId: owner.id })
      // 2) the export data query
      .mockResolvedValueOnce({
        id: "poll1",
        title: "T",
        commentVisibility: "EDITORS",
        questions: [{ id: "q1", prompt: "P", type: "FREE_TEXT", order: 0, config: null }],
        responses: [],
      });

    const data = await getResponsesForExport("poll1", owner);
    expect(prismaMock.poll.findUnique).toHaveBeenCalledTimes(2);
    expect(data.commentVisibility).toBe("EDITORS");
    expect(data.questions).toHaveLength(1);

    // The data query orders questions and ranked selections deterministically.
    const dataArg = prismaMock.poll.findUnique.mock.calls[1][0];
    expect(dataArg.select.questions.orderBy).toEqual({ order: "asc" });
    expect(
      dataArg.select.responses.select.answers.select.selectedOptions.orderBy
    ).toEqual({ rank: "asc" });
  });
});
