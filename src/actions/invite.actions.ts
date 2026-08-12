"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, requirePollOwner, AuthorizationError } from "@/lib/auth-guards";
import { inviteSchema } from "@/lib/validation/poll";
import { normalizeEmail } from "@/lib/utils";
import { sendInviteEmail } from "@/lib/invites";
import { ActionResult, fail, ok } from "@/types/actions";

/**
 * Invite one or more emails to a poll. Owner-only. Emails are normalized and
 * de-duplicated; existing accounts are linked immediately via userId. Uses
 * upsert on the (pollId,email) unique constraint so re-inviting is idempotent
 * and re-activates a previously revoked invite.
 */
export async function inviteEmailsAction(
  pollId: string,
  emailsRaw: string[]
): Promise<ActionResult<{ invited: number }>> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");

  let poll;
  try {
    poll = await requirePollOwner(pollId, user);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("Not authorized.");
    throw e;
  }

  const normalized = Array.from(
    new Set(emailsRaw.map(normalizeEmail).filter(Boolean))
  );

  const parsed = inviteSchema.safeParse({ pollId, emails: normalized });
  if (!parsed.success) {
    return fail("Please check the emails.", parsed.error.flatten().fieldErrors);
  }

  // Look up which emails already have accounts so we can link userId now.
  const users = await prisma.user.findMany({
    where: { email: { in: normalized } },
    select: { id: true, email: true },
  });
  const userByEmail = new Map(users.map((u) => [u.email, u.id]));

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  for (const email of normalized) {
    const linkedUserId = userByEmail.get(email) ?? null;
    const invite = await prisma.invite.upsert({
      where: { pollId_email: { pollId, email } },
      create: {
        pollId,
        email,
        userId: linkedUserId,
        status: linkedUserId ? "ACCEPTED" : "PENDING",
      },
      update: {
        // Re-activate revoked invites; link user if now registered.
        status: linkedUserId ? "ACCEPTED" : "PENDING",
        userId: linkedUserId,
      },
    });
    await sendInviteEmail({ email, pollTitle: poll.title, token: invite.token, baseUrl });
  }

  revalidatePath(`/polls/${pollId}/invite`);
  return ok({ invited: normalized.length });
}

export async function revokeInviteAction(inviteId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");

  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite) return fail("Invite not found.");

  // Verify the invite's poll belongs to the current user.
  try {
    await requirePollOwner(invite.pollId, user);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("Not authorized.");
    throw e;
  }

  await prisma.invite.update({
    where: { id: inviteId },
    data: { status: "REVOKED" },
  });

  revalidatePath(`/polls/${invite.pollId}/invite`);
  return ok();
}
