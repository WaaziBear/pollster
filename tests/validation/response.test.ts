import { describe, it, expect } from "vitest";
import { answerInputSchema, submitResponseSchema } from "@/lib/validation/response";

describe("answerInputSchema", () => {
  it("defaults selectedOptionIds to an empty array", () => {
    const res = answerInputSchema.safeParse({ questionId: "q1" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.selectedOptionIds).toEqual([]);
  });

  it("accepts a text answer", () => {
    const res = answerInputSchema.safeParse({ questionId: "q1", textValue: "hi" });
    expect(res.success).toBe(true);
  });

  it("accepts an integer rating", () => {
    const res = answerInputSchema.safeParse({ questionId: "q1", numberValue: 4 });
    expect(res.success).toBe(true);
  });

  it("rejects a non-integer rating", () => {
    const res = answerInputSchema.safeParse({ questionId: "q1", numberValue: 3.5 });
    expect(res.success).toBe(false);
  });

  it("requires a questionId", () => {
    const res = answerInputSchema.safeParse({ textValue: "x" });
    expect(res.success).toBe(false);
  });
});

describe("submitResponseSchema", () => {
  it("accepts a poll id with at least one answer", () => {
    const res = submitResponseSchema.safeParse({
      pollId: "poll1",
      answers: [{ questionId: "q1", selectedOptionIds: ["o1"] }],
    });
    expect(res.success).toBe(true);
  });

  it("rejects an empty answers array", () => {
    const res = submitResponseSchema.safeParse({ pollId: "poll1", answers: [] });
    expect(res.success).toBe(false);
  });
});
