import type { VisibleComment } from "@/lib/queries/polls";

/**
 * Render the list of visible comments for a single question. Attribution is
 * decided server-side (see getVisibleComments): an authored comment shows
 * `name (#id)`, an anonymized comment shows "Anonymous". This component never
 * receives author identity for anonymous polls.
 */
export function QuestionComments({ comments }: { comments: VisibleComment[] }) {
  if (!comments || comments.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Comments ({comments.length})
      </p>
      <ul className="space-y-2">
        {comments.map((c, i) => (
          <li
            key={i}
            className="rounded-md border bg-muted/40 p-3 text-sm"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {c.author ? `${c.author.name} (#${c.author.id})` : "Anonymous"}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{c.comment}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
