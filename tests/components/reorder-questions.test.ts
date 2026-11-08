import { describe, it, expect } from "vitest";
import { reorderQuestions, newQuestion } from "@/components/poll/draft";
import type { DraftQuestion } from "@/components/poll/draft";

/** Build N questions with deterministic ids q1..qN for readable assertions. */
function makeQuestions(n: number): DraftQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    ...newQuestion("FREE_TEXT"),
    id: `q${i + 1}`,
    prompt: `Q${i + 1}`,
  }));
}

const ids = (qs: DraftQuestion[]) => qs.map((q) => q.id);

describe("reorderQuestions", () => {
  it("moves a question down (drag q1 onto q3's slot)", () => {
    const qs = makeQuestions(4); // q1 q2 q3 q4
    const result = reorderQuestions(qs, "q1", "q3");
    expect(ids(result)).toEqual(["q2", "q3", "q1", "q4"]);
  });

  it("moves a question up (drag q4 onto q2's slot)", () => {
    const qs = makeQuestions(4); // q1 q2 q3 q4
    const result = reorderQuestions(qs, "q4", "q2");
    expect(ids(result)).toEqual(["q1", "q4", "q2", "q3"]);
  });

  it("swaps two adjacent questions", () => {
    const qs = makeQuestions(2); // q1 q2
    expect(ids(reorderQuestions(qs, "q1", "q2"))).toEqual(["q2", "q1"]);
  });

  it("returns the list unchanged when active === over (no-op drop)", () => {
    const qs = makeQuestions(3);
    const result = reorderQuestions(qs, "q2", "q2");
    expect(result).toBe(qs); // same reference — no work done
  });

  it("returns the list unchanged when an id is not found", () => {
    const qs = makeQuestions(3);
    expect(reorderQuestions(qs, "nope", "q1")).toBe(qs);
    expect(reorderQuestions(qs, "q1", "nope")).toBe(qs);
  });

  it("does not mutate the input array", () => {
    const qs = makeQuestions(3);
    const snapshot = ids(qs);
    reorderQuestions(qs, "q1", "q3");
    expect(ids(qs)).toEqual(snapshot); // original untouched
  });

  it("preserves the full question objects, only changing position", () => {
    const qs = makeQuestions(3);
    const result = reorderQuestions(qs, "q1", "q3");
    // q1's object is carried intact to its new slot (index 2).
    expect(result[2]).toBe(qs[0]);
    expect(result[2].prompt).toBe("Q1");
  });
});
