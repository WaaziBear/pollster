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
};

export function SharedPollCard({ poll }: { poll: SharedPollCardData }) {
  return (
    <Card className="group flex flex-col hover:border-primary/40 hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 font-heading">{poll.title}</CardTitle>
          {poll.hasResponded && <Badge variant="success">Answered</Badge>}
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
      <CardFooter className="mt-auto">
        <Button asChild size="sm" variant={poll.hasResponded ? "outline" : "cta"}>
          <Link href={`/polls/${poll.id}`}>
            {poll.hasResponded ? "View / edit answer" : "Answer poll"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
