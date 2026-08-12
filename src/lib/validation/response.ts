import { z } from "zod";

/**
 * A single answer payload from the client. Only the field relevant to the
 * question type is populated; the server re-validates each answer against the
 * question's actual type/config (never trusting the client).
 */
export const answerInputSchema = z.object({
  questionId: z.string().min(1),
  // choice types (single => length 1, multi => length >= 0)
  selectedOptionIds: z.array(z.string().min(1)).optional().default([]),
  // FREE_TEXT
  textValue: z.string().max(10000).optional(),
  // RATING
  numberValue: z.number().int().optional(),
});

export const submitResponseSchema = z.object({
  pollId: z.string().min(1),
  answers: z.array(answerInputSchema).min(1, "No answers provided"),
});

// Use the *input* type at the call boundary so fields with defaults
// (e.g. `selectedOptionIds`) remain optional for callers; the server parse
// fills defaults to produce the fully-populated output type.
export type AnswerInput = z.input<typeof answerInputSchema>;
export type SubmitResponseInput = z.input<typeof submitResponseSchema>;
