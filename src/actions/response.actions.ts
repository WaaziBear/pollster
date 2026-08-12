"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canAccessPoll } from "@/lib/auth-guards";
import { submitResponseSchema, type SubmitResponseInput } from "@/lib/validation/response";
import { ActionResult, fail, ok } from "@/types/actions";

/**
 * Submit (or edit-in-place update) a response to a poll.
 *
 * Security-critical: the caller MUST be an invitee or the owner (canAccessPoll,
 * enforced against the DB). Every answer is re-validated server-side against
 * the question's ACTUAL type/config — the client is never trusted:
 *   - SINGLE_CHOICE: exactly one selected option, belonging to the question.
 *   - MULTI_CHOICE:  options belong to the question; respects maxSelections.
 *   - FREE_TEXT:     length within config.maxLength.
 *   - RATING:        integer within config.min/max.
 *   - required:      enforced for every type.
 */
export async function submitResponseAction(
  input: SubmitResponseInput
): Promise<ActionResult<{ responseId: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");

  const parsed = submitResponseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid submission.", parsed.error.flatten().fieldErrors);
  }
  const { pollId, answers } = parsed.data;

  // Authorization: owner OR non-revoked invitee, against the DB.
  const { allowed } = await canAccessPoll(pollId, user);
  if (!allowed) return fail("Not authorized to answer this poll.");

  // Load the real questions + options for validation.
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { questions: { include: { options: true } } },
  });
  if (!poll) return fail("Poll not found.");
  if (!poll.isPublished && poll.creatorId !== user.id) {
    return fail("This poll is not open for responses.");
  }

  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const fieldErrors: Record<string, string[]> = {};

  // Validated payloads to persist, keyed by questionId.
  type ValidAnswer = {
    questionId: string;
    textValue: string | null;
    numberValue: number | null;
    optionIds: string[];
  };
  const toPersist: ValidAnswer[] = [];

  for (const q of poll.questions) {
    const a = answerByQuestion.get(q.id);
    const validOptionIds = new Set(q.options.map((o) => o.id));
    const config = (q.config as Record<string, unknown> | null) ?? {};

    const addError = (msg: string) => {
      fieldErrors[q.id] = [...(fieldErrors[q.id] ?? []), msg];
    };

    const isEmpty =
      !a ||
      (a.selectedOptionIds.length === 0 &&
        (a.textValue === undefined || a.textValue.trim() === "") &&
        (a.numberValue === undefined || a.numberValue === null));

    if (isEmpty) {
      if (q.required) addError("This question is required.");
      continue;
    }

    switch (q.type) {
      case "SINGLE_CHOICE": {
        const ids = a!.selectedOptionIds;
        if (ids.length !== 1) {
          addError("Select exactly one option.");
          break;
        }
        if (!validOptionIds.has(ids[0])) {
          addError("Invalid option selected.");
          break;
        }
        toPersist.push({ questionId: q.id, textValue: null, numberValue: null, optionIds: ids });
        break;
      }
      case "MULTI_CHOICE": {
        const ids = a!.selectedOptionIds;
        if (ids.some((id) => !validOptionIds.has(id))) {
          addError("Invalid option selected.");
          break;
        }
        const maxSel = typeof config.maxSelections === "number" ? config.maxSelections : undefined;
        if (maxSel !== undefined && ids.length > maxSel) {
          addError(`Select at most ${maxSel} option(s).`);
          break;
        }
        // de-dup
        const unique = Array.from(new Set(ids));
        toPersist.push({ questionId: q.id, textValue: null, numberValue: null, optionIds: unique });
        break;
      }
      case "FREE_TEXT": {
        const text = (a!.textValue ?? "").trim();
        const maxLength = typeof config.maxLength === "number" ? config.maxLength : 10000;
        if (text.length > maxLength) {
          addError(`Answer must be at most ${maxLength} characters.`);
          break;
        }
        toPersist.push({ questionId: q.id, textValue: text, numberValue: null, optionIds: [] });
        break;
      }
      case "RATING": {
        const n = a!.numberValue;
        if (n === undefined || n === null || !Number.isInteger(n)) {
          addError("Provide a valid rating.");
          break;
        }
        const min = typeof config.min === "number" ? config.min : 1;
        const max = typeof config.max === "number" ? config.max : 5;
        if (n < min || n > max) {
          addError(`Rating must be between ${min} and ${max}.`);
          break;
        }
        toPersist.push({ questionId: q.id, textValue: null, numberValue: n, optionIds: [] });
        break;
      }
      default:
        addError("Unsupported question type.");
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail("Please fix the highlighted answers.", fieldErrors);
  }

  // Upsert response + replace answers atomically.
  const responseId = await prisma.$transaction(async (tx) => {
    const response = await tx.response.upsert({
      where: { pollId_respondentId: { pollId, respondentId: user.id } },
      create: { pollId, respondentId: user.id },
      update: {},
    });

    // Clear previous answers (edit-in-place), then recreate.
    await tx.answer.deleteMany({ where: { responseId: response.id } });

    for (const va of toPersist) {
      await tx.answer.create({
        data: {
          responseId: response.id,
          questionId: va.questionId,
          textValue: va.textValue,
          numberValue: va.numberValue,
          selectedOptions: va.optionIds.length
            ? { create: va.optionIds.map((optionId) => ({ optionId })) }
            : undefined,
        },
      });
    }
    return response.id;
  });

  revalidatePath(`/polls/${pollId}`);
  revalidatePath(`/polls/${pollId}/results`);
  return ok({ responseId });
}
