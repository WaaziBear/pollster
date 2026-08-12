import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { linkInvitesToUser } from "@/lib/invites";

/**
 * Invite-link landing. The token alone is NOT access — we still resolve the
 * signed-in user (requireUser redirects unauthenticated visitors to /login,
 * preserving the return URL) and then send them to the poll, where
 * getPollForRespondent enforces the real authorization predicate.
 */
export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await requireUser();

  const invite = await prisma.invite.findUnique({
    where: { token },
    select: { pollId: true, email: true, status: true, userId: true },
  });

  if (!invite || invite.status === "REVOKED") notFound();

  // If the signed-in user's email matches the invite, back-fill the link so the
  // poll surfaces in their "Shared With Me" list. Access is still re-checked
  // on the poll page itself.
  if (invite.email === user.email && !invite.userId) {
    await linkInvitesToUser(user.email, user.id);
  }

  redirect(`/polls/${invite.pollId}`);
}
