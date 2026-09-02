import { requireUser } from "@/lib/auth-guards";
import { PollBuilder } from "@/components/poll/poll-builder";
import { newQuestion, type DraftPoll } from "@/components/poll/draft";

export const metadata = { title: "New poll — Pollster" };

export default async function NewPollPage() {
  // Guard: pages redirect unauthenticated users to /login.
  await requireUser();

  const initial: DraftPoll = {
    title: "",
    description: "",
    commentVisibility: "EDITORS",
    questions: [newQuestion("SINGLE_CHOICE")],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Create a poll</h1>
        <p className="text-sm text-muted-foreground">
          Add a title and one or more questions. Save as a draft or publish to
          start collecting responses.
        </p>
      </div>
      <PollBuilder mode="create" initial={initial} />
    </div>
  );
}
