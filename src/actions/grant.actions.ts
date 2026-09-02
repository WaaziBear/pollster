"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  requirePollOwner,
  AuthorizationError,
} from "@/lib/auth-guards";
import { grantSchema } from "@/lib/validation/poll";
import { normalizeEmail } from "@/lib/utils";
import { ActionResult, fail, ok } from "@/types/actions";
import type { PollRole } from "@prisma/client";

/**
 * Grant one or more emails a role on a poll. OWNER-ONLY.
 *
 * Emails are normalized + de-duplicated; an existing account is linked
 * immediately via userId (mirroring the invite flow). Uses upsert on the
 * (pollId,email) unique constraint so re-granting is idempotent and updates the
 * role of an existing grant.
 */
export async function grantAccessAction(
  pollId: string,
  emailsRaw: string[],
  role: PollRole
): Promise<ActionResult<{ granted: number }>> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");

  // Owner-only: granting/revoking access is never delegated to editors.
  try {
    await requirePollOwner(pollId, user);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("Not authorized.");
    throw e;
  }

  const normalized = Array.from(
    new Set(emailsRaw.map(normalizeEmail).filter(Boolean))
  );

  const parsed = grantSchema.safeParse({ pollId, emails: normalized, role });
  if (!parsed.success) {
    return fail("Please check the input.", parsed.error.flatten().fieldErrors);
  }

  // Link userId now for any email that already owns an account.
  const users = await prisma.user.findMany({
    where: { email: { in: normalized } },
    select: { id: true, email: true },
  });
  const userByEmail = new Map(users.map((u) => [u.email, u.id]));

  for (const email of normalized) {
    const linkedUserId = userByEmail.get(email) ?? null;
    await prisma.pollAccess.upsert({
      where: { pollId_email: { pollId, email } },
      create: { pollId, email, role, userId: linkedUserId },
      update: { role, userId: linkedUserId },
    });
  }

  revalidatePath(`/polls/${pollId}/invite`);
  return ok({ granted: normalized.length });
}

/**
 * Revoke (delete) an access grant. OWNER-ONLY: the caller must own the poll the
 * grant belongs to.
 */
export async function revokeAccessAction(
  accessId: string
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("You must be signed in.");

  const grant = await prisma.pollAccess.findUnique({
    where: { id: accessId },
    select: { id: true, pollId: true },
  });
  if (!grant) return fail("Grant not found.");

  // Verify the grant's poll belongs to the current user.
  try {
    await requirePollOwner(grant.pollId, user);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("Not authorized.");
    throw e;
  }

  await prisma.pollAccess.delete({ where: { id: accessId } });

  revalidatePath(`/polls/${grant.pollId}/invite`);
  return ok();
}
