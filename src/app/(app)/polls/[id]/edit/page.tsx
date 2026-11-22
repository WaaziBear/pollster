import { notFound } from "next/navigation";
import { requireUser, requirePollEditor, AuthorizationError } from "@/lib/auth-guards";
import { getPollForEdit } from "@/lib/queries/polls";
import { PollBuilder } from "@/components/poll/poll-builder";
import { uid, type DraftPoll, type DraftQuestion } from "@/components/poll/draft";

export default async function EditPollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // Owner or EDITOR may edit — enforced server-side before any data is loaded.
  try {
    await requirePollEditor(id, user);
  } catch (e) {
    if (e instanceof AuthorizationError) notFound();
    throw e;
  }

  const poll = await getPollForEdit(id);
  if (!poll) notFound();

  const initial: DraftPoll = {
    title: poll.title,
    description: poll.description ?? "",
    commentVisibility: poll.commentVisibility,
    isPublic: poll.isPublic,
    questions: poll.questions.map((q): DraftQuestion => {
      const config = (q.config as Record<string, unknown> | null) ?? {};
      return {
        id: uid("q"),
        type: q.type,
        prompt: q.prompt,
        required: q.required,
        options: q.options.map((o) => ({ id: uid("o"), label: o.label })),
        ratingMin: typeof config.min === "number" ? config.min : 1,
        ratingMax: typeof config.max === "number" ? config.max : 5,
        maxLength: typeof config.maxLength === "number" ? config.maxLength : 500,
        maxSelections:
          typeof config.maxSelections === "number" ? config.maxSelections : undefined,
        ranked: config.ranked === true,
      };
    }),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Edit poll</h1>
        <p className="text-sm text-muted-foreground">
          Editing replaces the poll&apos;s questions. Existing responses to
          removed questions are discarded.
        </p>
      </div>
      <PollBuilder
        mode="edit"
        pollId={poll.id}
        initial={initial}
        initiallyPublished={poll.isPublished}
      />
    </div>
  );
}
