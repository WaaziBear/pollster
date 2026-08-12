import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";

export type SessionUser = { id: string; email: string; name?: string | null };

/**
 * Custom error thrown by guards on authorization failure. Callers in Server
 * Components typically catch this and render notFound()/403; server actions
 * return a structured error. The message is intentionally generic.
 */
export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Require an authenticated user. Redirects to /login when unauthenticated
 * (safe default for Server Components / pages). Use `getSessionUser` in server
 * actions where you want to return an error instead of redirecting.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }
  return {
    id: session.user.id,
    email: normalizeEmail(session.user.email),
    name: session.user.name,
  };
}

/** Non-redirecting variant for server actions. Returns null when unauthenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: normalizeEmail(session.user.email),
    name: session.user.name,
  };
}

/**
 * Require that the current user OWNS the poll. Throws AuthorizationError
 * otherwise. Returns the poll row on success.
 */
export async function requirePollOwner(pollId: string, user: SessionUser) {
  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll || poll.creatorId !== user.id) {
    throw new AuthorizationError();
  }
  return poll;
}

/**
 * Authorization predicate for viewing/answering a poll.
 *
 * A user may access poll P iff:
 *   - they are the creator (any state), OR
 *   - the poll isPublished AND a non-REVOKED Invite exists matching the user
 *     by userId OR by normalized email.
 *
 * This is enforced entirely in the DB query — an unauthorized user cannot even
 * fetch another poll's questions.
 */
export async function canAccessPoll(
  pollId: string,
  user: SessionUser
): Promise<{ allowed: boolean; isOwner: boolean }> {
  const poll = await prisma.poll.findFirst({
    where: {
      id: pollId,
      OR: [
        { creatorId: user.id },
        {
          isPublished: true,
          invites: {
            some: {
              status: { not: "REVOKED" },
              OR: [{ userId: user.id }, { email: user.email }],
            },
          },
        },
      ],
    },
    select: { id: true, creatorId: true },
  });

  if (!poll) return { allowed: false, isOwner: false };
  return { allowed: true, isOwner: poll.creatorId === user.id };
}

/**
 * Require that the current user may answer the poll (invitee, non-owner path
 * primarily, but owner is also allowed to preview). Throws on failure.
 */
export async function requireInvitee(pollId: string, user: SessionUser) {
  const { allowed } = await canAccessPoll(pollId, user);
  if (!allowed) throw new AuthorizationError();
}
