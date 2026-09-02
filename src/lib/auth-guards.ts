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

/** Effective role of a user on a poll (highest capability wins). */
export type PollRoleForUser = "OWNER" | "EDITOR" | "RESULTS_VIEWER" | null;

/**
 * Single shared predicate for per-poll authorization. Loads the poll and the
 * caller's effective role:
 *   1. creatorId match           -> OWNER
 *   2. PollAccess grant (by userId, OR by email as a fallback for accounts not
 *      yet linked) -> EDITOR (outranks) or RESULTS_VIEWER
 *   otherwise                    -> null
 *
 * Returns the poll row alongside the role so throwing guards can hand callers
 * the poll without a second round-trip. `poll` is null only when the poll does
 * not exist.
 */
async function loadPollWithRole(
  pollId: string,
  user: SessionUser
): Promise<{ poll: Awaited<ReturnType<typeof prisma.poll.findUnique>>; role: PollRoleForUser }> {
  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll) return { poll: null, role: null };
  if (poll.creatorId === user.id) return { poll, role: "OWNER" };

  const grants = await prisma.pollAccess.findMany({
    where: {
      pollId,
      OR: [{ userId: user.id }, { email: user.email }],
    },
    select: { role: true },
  });
  const roles = grants.map((g) => g.role);
  const role: PollRoleForUser = roles.includes("EDITOR")
    ? "EDITOR"
    : roles.includes("RESULTS_VIEWER")
      ? "RESULTS_VIEWER"
      : null;
  return { poll, role };
}

/**
 * Non-throwing role resolver. Returns 'OWNER' | 'EDITOR' | 'RESULTS_VIEWER' |
 * null. Used for role-aware UI and read paths.
 */
export async function getPollRoleForUser(
  pollId: string,
  user: SessionUser
): Promise<PollRoleForUser> {
  const { role } = await loadPollWithRole(pollId, user);
  return role;
}

/**
 * Require EDITOR capability (owner OR an EDITOR grant). Editors may edit poll
 * content/settings, publish/unpublish, and manage respondent invites. Throws
 * AuthorizationError otherwise. Returns the poll row on success.
 */
export async function requirePollEditor(pollId: string, user: SessionUser) {
  const { poll, role } = await loadPollWithRole(pollId, user);
  if (!poll || (role !== "OWNER" && role !== "EDITOR")) {
    throw new AuthorizationError();
  }
  return poll;
}

/**
 * Require results access (owner OR EDITOR OR RESULTS_VIEWER). Gates the results
 * page and the raw-response Excel export. Throws AuthorizationError otherwise.
 * Returns the poll row on success.
 */
export async function requireResultsAccess(pollId: string, user: SessionUser) {
  const { poll, role } = await loadPollWithRole(pollId, user);
  if (!poll || role === null) {
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
