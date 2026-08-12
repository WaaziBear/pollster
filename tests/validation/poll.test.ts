import { describe, it, expect } from "vitest";
import { pollSchema, questionSchema, inviteSchema } from "@/lib/validation/poll";

const singleChoice = {
  type: "SINGLE_CHOICE",
  prompt: "Pick one",
  options: [{ label: "A" }, { label: "B" }],
};
const multiChoice = {
  type: "MULTI_CHOICE",
  prompt: "Pick many",
  options: [{ label: "A" }, { label: "B" }, { label: "C" }],
  config: { maxSelections: 2 },
};
const freeText = { type: "FREE_TEXT", prompt: "Say something", config: { maxLength: 500 } };
const rating = { type: "RATING", prompt: "Rate it", config: { min: 1, max: 5 } };

describe("questionSchema per-type validation", () => {
  it("accepts a valid single-choice question", () => {
    expect(questionSchema.safeParse(singleChoice).success).toBe(true);
  });

  it("accepts a valid multi-choice question", () => {
    expect(questionSchema.safeParse(multiChoice).success).toBe(true);
  });

  it("accepts a valid free-text question", () => {
    expect(questionSchema.safeParse(freeText).success).toBe(true);
  });

  it("accepts a valid rating question", () => {
    expect(questionSchema.safeParse(rating).success).toBe(true);
  });

  it("rejects a choice question with fewer than 2 options", () => {
    const res = questionSchema.safeParse({
      type: "SINGLE_CHOICE",
      prompt: "Bad",
      options: [{ label: "only one" }],
    });
    expect(res.success).toBe(false);
  });

  it("rejects a rating question where max <= min", () => {
    const res = questionSchema.safeParse({
      type: "RATING",
      prompt: "Bad rating",
      config: { min: 5, max: 5 },
    });
    expect(res.success).toBe(false);
  });

  it("rejects a rating range that is too large", () => {
    const res = questionSchema.safeParse({
      type: "RATING",
      prompt: "Huge",
      config: { min: 0, max: 200 },
    });
    expect(res.success).toBe(false);
  });

  it("rejects an unknown question type (extensible enum guard)", () => {
    const res = questionSchema.safeParse({ type: "DATE", prompt: "When?" });
    expect(res.success).toBe(false);
  });

  it("defaults required to false", () => {
    const res = questionSchema.safeParse(freeText);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.required).toBe(false);
  });
});

describe("pollSchema", () => {
  it("accepts a poll with multiple varied question types", () => {
    const res = pollSchema.safeParse({
      title: "My survey",
      description: "desc",
      isPublished: true,
      questions: [singleChoice, multiChoice, freeText, rating],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.questions).toHaveLength(4);
  });

  it("requires a title", () => {
    const res = pollSchema.safeParse({ title: "", questions: [freeText] });
    expect(res.success).toBe(false);
  });

  it("requires at least one question", () => {
    const res = pollSchema.safeParse({ title: "Empty", questions: [] });
    expect(res.success).toBe(false);
  });

  it("rejects a poll where one question is invalid", () => {
    const res = pollSchema.safeParse({
      title: "Has bad q",
      questions: [freeText, { type: "SINGLE_CHOICE", prompt: "bad", options: [] }],
    });
    expect(res.success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("accepts a list of valid emails", () => {
    const res = inviteSchema.safeParse({
      pollId: "poll1",
      emails: ["a@b.com", "c@d.com"],
    });
    expect(res.success).toBe(true);
  });

  it("rejects when an email is invalid", () => {
    const res = inviteSchema.safeParse({ pollId: "poll1", emails: ["nope"] });
    expect(res.success).toBe(false);
  });

  it("rejects an empty email list", () => {
    const res = inviteSchema.safeParse({ pollId: "poll1", emails: [] });
    expect(res.success).toBe(false);
  });
});
