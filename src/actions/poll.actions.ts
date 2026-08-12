"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser, requirePollOwner, AuthorizationError } from "@/lib/auth-guards";
import { pollSchema, type PollInput } from "@/lib/validation/poll";
import { ActionResult, fail, ok } from "@/types/actions";

/**
 * Persist questions (+ options) for a poll inside a transaction. Used by both
 * create and update. On update we replace questions wholesale (simplest correct
 * approach; cascades remove old options/answers).
 */
async function writeQuestions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pollId: string,
  questions: PollInput["questions"]
) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await tx.question.create({
      data: {
        pollId,
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
      },
    });
  }
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

  const pollId = await prisma.$transaction(async (tx) => {
    const poll = await tx.poll.create({
      data: {
        title: data.title,
        description: data.description || null,
        isPublished: data.isPublished,
        creatorId: user.id,
      },
    });
    await writeQuestions(tx, poll.id, data.questions);
    return poll.id;
  });

  revalidatePath("/dashboard");
  return ok({ pollId });
}

export async function updatePollAction(
  pollId: string,
  input: PollInput
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");

  try {
    await requirePollOwner(pollId, user);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("Not authorized.");
    throw e;
  }

  const parsed = pollSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.poll.update({
      where: { id: pollId },
      data: {
        title: data.title,
        description: data.description || null,
        isPublished: data.isPublished,
      },
    });
    // Replace questions wholesale (cascades delete old options/answers).
    await tx.question.deleteMany({ where: { pollId } });
    await writeQuestions(tx, pollId, data.questions);
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
    await requirePollOwner(pollId, user);
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
