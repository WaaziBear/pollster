import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type MyPollCardData = {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  hasResponded: boolean;
  _count: { questions: number; invites: number; responses: number };
};

export function MyPollCard({ poll }: { poll: MyPollCardData }) {
  return (
    <Card className="group flex flex-col hover:border-primary/40 hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 font-heading">{poll.title}</CardTitle>
          <Badge variant={poll.isPublished ? "success" : "secondary"}>
            {poll.isPublished ? "Published" : "Draft"}
          </Badge>
        </div>
        {poll.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {poll.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{poll._count.questions} questions</span>
        <span>{poll._count.invites} invited</span>
        <span>{poll._count.responses} responses</span>
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/polls/${poll.id}/edit`}>Edit</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/polls/${poll.id}/invite`}>Invite</Link>
        </Button>
        {/* Owners can answer their own poll once it's published; drafts stay read-only. */}
        {poll.isPublished && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/polls/${poll.id}`}>
              {poll.hasResponded ? "View / update answer" : "Answer"}
            </Link>
          </Button>
        )}
        <Button asChild size="sm">
          <Link href={`/polls/${poll.id}/results`}>Results</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export type SharedPollCardData = {
  id: string;
  title: string;
  description: string | null;
  creator: { email: string; name: string | null };
  _count: { questions: number };
  hasResponded: boolean;
  // When present, the poll is shared via an access GRANT. The card surfaces the
  // grantee's capabilities (all of which are enforced server-side):
  //   EDITOR         -> Edit, Invite, Results, Answer
  //   RESULTS_VIEWER -> Results, Answer
  // When null/absent, the poll is shared via an invite and the only action is
  // Answer.
  role?: "EDITOR" | "RESULTS_VIEWER" | null;
};

export function SharedPollCard({ poll }: { poll: SharedPollCardData }) {
  return (
    <Card className="group flex flex-col hover:border-primary/40 hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 font-heading">{poll.title}</CardTitle>
          {poll.role ? (
            <Badge variant={poll.role === "EDITOR" ? "default" : "secondary"}>
              {poll.role === "EDITOR" ? "Editor" : "Results viewer"}
            </Badge>
          ) : (
            poll.hasResponded && <Badge variant="success">Answered</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          from {poll.creator.name ?? poll.creator.email}
        </p>
        {poll.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {poll.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {poll._count.questions} questions
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        {/* Editors manage content, manage invites, and view results —
            matching their server-side capabilities. */}
        {poll.role === "EDITOR" && (
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/polls/${poll.id}/edit`}>Edit</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/polls/${poll.id}/invite`}>Invite</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/polls/${poll.id}/results`}>Results</Link>
            </Button>
          </>
        )}
        {/* Results viewers can only view results. */}
        {poll.role === "RESULTS_VIEWER" && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/polls/${poll.id}/results`}>Results</Link>
          </Button>
        )}
        {/* Answer action for everyone with access to the published poll:
            invitees, editors, and results-viewers. Invitees keep the CTA
            emphasis and response-aware label; for grantees it's a secondary
            action (their response state isn't tracked on the dashboard yet). */}
        <Button
          asChild
          size="sm"
          variant={!poll.role && !poll.hasResponded ? "cta" : "outline"}
        >
          <Link href={`/polls/${poll.id}`}>
            {poll.role
              ? "Answer"
              : poll.hasResponded
                ? "View / edit answer"
                : "Answer poll"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
