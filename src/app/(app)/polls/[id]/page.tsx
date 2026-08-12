import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { getPollForRespondent } from "@/lib/queries/polls";
import { AnswerForm, type AnswerFormQuestion } from "@/components/poll/answer-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function PollRespondPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // Authorization is enforced inside the query: a non-invited user gets null.
  const result = await getPollForRespondent(id, user);
  if (!result) notFound();

  const { poll, existingResponse, isOwner } = result;

  // A draft poll can only be previewed by its owner.
  const isPreview = isOwner && !poll.isPublished;

  const questions: AnswerFormQuestion[] = poll.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    required: q.required,
    order: q.order,
    config: (q.config as Record<string, unknown> | null) ?? null,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
  }));

  // Prefill from an existing response (edit-in-place).
  const initialAnswers: Record<
    string,
    { selectedOptionIds: string[]; textValue: string; numberValue: number | null }
  > = {};
  if (existingResponse) {
    for (const a of existingResponse.answers) {
      initialAnswers[a.questionId] = {
        selectedOptionIds: a.selectedOptions.map((s) => s.optionId),
        textValue: a.textValue ?? "",
        numberValue: a.numberValue ?? null,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold font-heading tracking-tight">{poll.title}</h1>
          {isPreview && <Badge variant="secondary">Draft preview</Badge>}
          {existingResponse && <Badge variant="success">Answered</Badge>}
        </div>
        {poll.description && (
          <p className="text-muted-foreground">{poll.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          from {poll.creator.name ?? poll.creator.email}
        </p>
      </div>

      {isPreview ? (
        <div className="rounded-lg border border-dashed p-6">
          <p className="text-sm text-muted-foreground">
            This poll is a draft. Publish it before inviting people to respond.
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/polls/${poll.id}/edit`}>Edit poll</Link>
            </Button>
          </div>
          <div className="pointer-events-none mt-6 opacity-70">
            <AnswerForm
              pollId={poll.id}
              questions={questions}
              initialAnswers={initialAnswers}
              readOnly
            />
          </div>
        </div>
      ) : (
        <AnswerForm
          pollId={poll.id}
          questions={questions}
          initialAnswers={initialAnswers}
          hasResponded={!!existingResponse}
        />
      )}
    </div>
  );
}
