import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { getMyPolls, getSharedPolls } from "@/lib/queries/polls";
import { MyPollCard, SharedPollCard } from "@/components/poll/poll-card";
import { Button } from "@/components/ui/button";
import { Inbox, PlusCircle } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();

  const [myPolls, sharedPolls] = await Promise.all([
    getMyPolls(user.id),
    getSharedPolls(user.id, user.email),
  ]);

  return (
    <div className="space-y-12">
      <section aria-labelledby="my-polls-heading">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2
            id="my-polls-heading"
            className="text-2xl font-bold font-heading tracking-tight"
          >
            My Polls
          </h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/polls/new">
              <PlusCircle className="h-4 w-4" /> Create poll
            </Link>
          </Button>
        </div>

        {myPolls.length === 0 ? (
          <EmptyState
            title="No polls yet"
            description="Create your first poll to start collecting responses."
            action={
              <Button asChild variant="cta">
                <Link href="/polls/new">Create your first poll</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myPolls.map((p) => (
              <MyPollCard key={p.id} poll={p} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="shared-heading">
        <h2
          id="shared-heading"
          className="mb-6 text-2xl font-bold font-heading tracking-tight"
        >
          Shared With Me
        </h2>

        {sharedPolls.length === 0 ? (
          <EmptyState
            title="Nothing shared yet"
            description="Polls you're invited to will appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedPolls.map((p) => (
              <SharedPollCard key={p.id} poll={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Inbox className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="font-semibold font-heading">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
