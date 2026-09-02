"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser, requirePollOwner, requirePollEditor, AuthorizationError } from "@/lib/auth-guards";
import { pollSchema, type PollInput } from "@/lib/validation/poll";
import { ActionResult, fail, ok } from "@/types/actions";

/**
 * Pure mapping from validated questions to the nested `create` payload for a
 * poll write. Used by both create and update so a single round-trip nested
 * write persists all questions (+ options) atomically — avoiding the per-question
 * round-trips that previously blew the interactive-transaction timeout.
 */
function buildQuestionsCreate(
  questions: PollInput["questions"]
): Prisma.QuestionCreateWithoutPollInput[] {
  return questions.map((q, i) => ({
    type: q.type,
    prompt: q.prompt,
    required: q.required,
    order: i,
    config:
      q.config === undefined
        ? undefined
        : (q.config as Prisma.InputJsonValue),
    options:
      q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE"
        ? {
            create: q.options.map((o, oi) => ({
              label: o.label,
              order: oi,
            })),
          }
        : undefined,
  }));
}

export async function createPollAction(
  input: PollInput
): Promise<ActionResult<{ pollId: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");

  const parsed = pollSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  // Single nested write: poll + all questions (+ options) persist atomically in
  // one round-trip. No interactive $transaction, so no cross-region latency can
  // exceed the 5000ms interactive-transaction budget.
  const poll = await prisma.poll.create({
    data: {
      title: data.title,
      description: data.description || null,
      isPublished: data.isPublished,
      commentVisibility: data.commentVisibility,
      creatorId: user.id,
      questions: { create: buildQuestionsCreate(data.questions) },
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");
  return ok({ pollId: poll.id });
}

export async function updatePollAction(
  pollId: string,
  input: PollInput
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");

  try {
    await requirePollEditor(pollId, user);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("Not authorized.");
    throw e;
  }

  const parsed = pollSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // Single nested write: Prisma applies the nested deleteMany-then-create
  // atomically in one round-trip, replacing questions wholesale (cascades remove
  // old options/answers) without an interactive $transaction.
  await prisma.poll.update({
    where: { id: pollId },
    data: {
      title: data.title,
      description: data.description || null,
      isPublished: data.isPublished,
      commentVisibility: data.commentVisibility,
      questions: {
        deleteMany: {},
        create: buildQuestionsCreate(data.questions),
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/polls/${pollId}`);
  return ok();
}

export async function publishPollAction(
  pollId: string,
  isPublished: boolean
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");
  try {
    await requirePollEditor(pollId, user);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("Not authorized.");
    throw e;
  }

  await prisma.poll.update({ where: { id: pollId }, data: { isPublished } });
  revalidatePath("/dashboard");
  revalidatePath(`/polls/${pollId}`);
  return ok();
}

export async function deletePollAction(pollId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");
  try {
    await requirePollOwner(pollId, user);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("Not authorized.");
    throw e;
  }

  await prisma.poll.delete({ where: { id: pollId } });
  revalidatePath("/dashboard");
  return ok();
}
