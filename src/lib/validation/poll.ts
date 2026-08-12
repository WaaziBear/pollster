import { z } from "zod";

// Keep in sync with Prisma `QuestionType` enum.
export const questionTypeSchema = z.enum([
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "FREE_TEXT",
  "RATING",
]);

export type QuestionTypeInput = z.infer<typeof questionTypeSchema>;

const optionSchema = z.object({
  label: z.string().trim().min(1, "Option label is required").max(200),
});

// Per-type config. `.passthrough()` keeps this extensible for future types.
const configSchema = z
  .object({
    // RATING
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    step: z.number().int().positive().optional(),
    // FREE_TEXT
    maxLength: z.number().int().positive().max(10000).optional(),
    // MULTI_CHOICE
    maxSelections: z.number().int().positive().optional(),
  })
  .partial()
  .passthrough()
  .optional();

const baseQuestion = z.object({
  prompt: z.string().trim().min(1, "Question prompt is required").max(500),
  required: z.boolean().default(false),
  options: z.array(optionSchema).optional().default([]),
  config: configSchema,
});

/**
 * A single question in a poll builder payload, validated per-type:
 * - choice types require >= 2 options
 * - RATING requires a valid min < max range
 */
export const questionSchema = baseQuestion
  .extend({ type: questionTypeSchema })
  .superRefine((q, ctx) => {
    if (q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choice questions need at least 2 options",
          path: ["options"],
        });
      }
    }
    if (q.type === "RATING") {
      const min = q.config?.min ?? 1;
      const max = q.config?.max ?? 5;
      if (max <= min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rating max must be greater than min",
          path: ["config", "max"],
        });
      }
      if (max - min > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rating range is too large (max 100 steps)",
          path: ["config", "max"],
        });
      }
    }
  });

export const pollSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
  questions: z
    .array(questionSchema)
    .min(1, "Add at least one question")
    .max(50, "A poll can have at most 50 questions"),
});

export type PollInput = z.infer<typeof pollSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;

// Invite emails: comma/newline separated list normalized upstream.
export const inviteSchema = z.object({
  pollId: z.string().min(1),
  emails: z
    .array(z.string().trim().email("Invalid email").max(254))
    .min(1, "Enter at least one email")
    .max(200, "Too many emails at once"),
});

export type InviteInput = z.infer<typeof inviteSchema>;
