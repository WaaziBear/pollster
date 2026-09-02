import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser, requirePollEditor, AuthorizationError } from "@/lib/auth-guards";
import { getPollInvites, getPollGrants } from "@/lib/queries/polls";
import { InviteManager } from "@/components/poll/invite-manager";
import { AccessManager, type GrantRole } from "@/components/poll/access-manager";
import { Button } from "@/components/ui/button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // Owner OR editor may manage respondent invites — enforced server-side.
  let poll;
  try {
    poll = await requirePollEditor(id, user);
  } catch (e) {
    if (e instanceof AuthorizationError) notFound();
    throw e;
  }

  // Managing access grants is OWNER-ONLY; editors see invites but not the
  // Access & sharing manager.
  const isOwner = poll.creatorId === user.id;

  const invites = await getPollInvites(id);
  const grants = isOwner ? await getPollGrants(id) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Invitations</h1>
          <p className="text-sm text-muted-foreground">{poll.title}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">Back</Link>
        </Button>
      </div>

      {!poll.isPublished && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          This poll is a draft. Invited people won&apos;t be able to answer until
          you publish it from the{" "}
          <Link href={`/polls/${poll.id}/edit`} className="text-primary hover:underline">
            edit page
          </Link>
          .
        </div>
      )}

      <InviteManager
        pollId={poll.id}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          status: i.status,
          token: i.token,
        }))}
      />

      {isOwner && (
        <section className="space-y-4 border-t pt-8" aria-labelledby="access-heading">
          <div>
            <h2
              id="access-heading"
              className="text-xl font-bold font-heading tracking-tight"
            >
              Access &amp; sharing
            </h2>
            <p className="text-sm text-muted-foreground">
              Grant editors or results viewers access to this poll. Only you can
              manage access.
            </p>
          </div>
          <AccessManager
            pollId={poll.id}
            grants={grants.map((g) => ({
              id: g.id,
              email: g.email,
              role: g.role as GrantRole,
              userId: g.userId,
            }))}
          />
        </section>
      )}
    </div>
  );
}
