import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser, requirePollOwner, AuthorizationError } from "@/lib/auth-guards";
import { getResults } from "@/lib/queries/polls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // getResults itself performs NO auth check, so the page MUST guard ownership.
  try {
    await requirePollOwner(id, user);
  } catch (e) {
    if (e instanceof AuthorizationError) notFound();
    throw e;
  }

  const results = await getResults(id);
  if (!results) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">{results.title}</h1>
          <p className="text-sm text-muted-foreground">
            {results.responseCount} response
            {results.responseCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/polls/${id}/invite`}>Invite</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Back</Link>
          </Button>
        </div>
      </div>

      {results.responseCount === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No responses yet. Share the poll with invited people to collect answers.
        </div>
      )}

      <div className="space-y-4">
        {results.questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">
                  {i + 1}. {q.prompt}
                </CardTitle>
                <Badge variant="outline">{labelForType(q.type)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {q.kind === "choice" && <ChoiceResult options={q.options} total={q.total} />}
              {q.kind === "rating" && (
                <RatingResult
                  count={q.count}
                  average={q.average}
                  distribution={q.distribution}
                />
              )}
              {q.kind === "text" && <TextResult texts={q.texts} />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function labelForType(type: string): string {
  switch (type) {
    case "SINGLE_CHOICE":
      return "Single choice";
    case "MULTI_CHOICE":
      return "Multiple choice";
    case "FREE_TEXT":
      return "Free text";
    case "RATING":
      return "Rating";
    default:
      return type;
  }
}

function ChoiceResult({
  options,
  total,
}: {
  options: { id: string; label: string; count: number }[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      {options.map((o) => {
        const pct = total > 0 ? Math.round((o.count / total) * 100) : 0;
        return (
          <div key={o.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{o.label}</span>
              <span className="text-muted-foreground">
                {o.count} ({pct}%)
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${o.label}: ${pct}%`}
            >
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {options.length === 0 && (
        <p className="text-sm text-muted-foreground">No options.</p>
      )}
    </div>
  );
}

function RatingResult({
  count,
  average,
  distribution,
}: {
  count: number;
  average: number;
  distribution: Record<number, number>;
}) {
  const entries = Object.entries(distribution)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0]);
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0);

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Average:{" "}
        <span className="font-semibold">{count > 0 ? average.toFixed(2) : "—"}</span>{" "}
        <span className="text-muted-foreground">({count} responses)</span>
      </p>
      <div className="space-y-1">
        {entries.map(([value, c]) => {
          const pct = max > 0 ? Math.round((c / max) * 100) : 0;
          return (
            <div key={value} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-right text-muted-foreground">{value}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right text-muted-foreground">{c}</span>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No ratings yet.</p>
        )}
      </div>
    </div>
  );
}

function TextResult({ texts }: { texts: string[] }) {
  if (texts.length === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {texts.map((t, i) => (
        <li key={i} className="rounded-md border bg-muted/40 p-3 text-sm">
          {t}
        </li>
      ))}
    </ul>
  );
}
