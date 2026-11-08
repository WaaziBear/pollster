"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { QuestionEditor } from "./question-editor";
import {
  DraftPoll,
  DraftQuestion,
  newQuestion,
  reorderQuestions,
  QUESTION_TYPE_LABELS,
  COMMENT_VISIBILITY_LABELS,
} from "./draft";
import type {
  PollInput,
  QuestionTypeInput,
  CommentVisibilityInput,
} from "@/lib/validation/poll";
import { createPollAction, updatePollAction } from "@/actions/poll.actions";
import { Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";

function draftToInput(draft: DraftPoll, isPublished: boolean): PollInput {
  return {
    title: draft.title,
    description: draft.description,
    isPublished,
    commentVisibility: draft.commentVisibility,
    questions: draft.questions.map((q) => ({
      type: q.type,
      prompt: q.prompt,
      required: q.required,
      options:
        q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE"
          ? q.options.map((o) => ({ label: o.label }))
          : [],
      config:
        q.type === "RATING"
          ? { min: q.ratingMin, max: q.ratingMax, step: 1 }
          : q.type === "FREE_TEXT"
            ? { maxLength: q.maxLength ?? 500 }
            : q.type === "MULTI_CHOICE"
              ? buildMultiConfig(q.maxSelections, q.ranked)
              : undefined,
    })),
  };
}

/**
 * MULTI_CHOICE config combines an optional maxSelections cap and an opt-in
 * `ranked` flag. Returns undefined when neither is set so unranked, uncapped
 * questions store no config (backward compatible).
 */
function buildMultiConfig(
  maxSelections: number | undefined,
  ranked: boolean | undefined
): { maxSelections?: number; ranked?: boolean } | undefined {
  const config: { maxSelections?: number; ranked?: boolean } = {};
  if (maxSelections) config.maxSelections = maxSelections;
  if (ranked) config.ranked = true;
  return Object.keys(config).length > 0 ? config : undefined;
}

export function PollBuilder({
  mode,
  pollId,
  initial,
  initiallyPublished = false,
}: {
  mode: "create" | "edit";
  pollId?: string;
  initial: DraftPoll;
  initiallyPublished?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPoll>(initial);
  const [addType, setAddType] = useState<QuestionTypeInput>("SINGLE_CHOICE");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const setQuestion = (id: string, q: DraftQuestion) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((x) => (x.id === id ? q : x)),
    }));

  const addQuestion = () =>
    setDraft((d) => ({ ...d, questions: [...d.questions, newQuestion(addType)] }));

  const removeQuestion = (id: string) =>
    setDraft((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== id) }));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small activation distance so a click on the handle's buttons/icon
      // isn't swallowed as a drag.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((d) => ({
      ...d,
      questions: reorderQuestions(d.questions, String(active.id), String(over.id)),
    }));
  };

  const submit = (isPublished: boolean) => {
    setError(null);
    setFieldErrors({});
    const input = draftToInput(draft, isPublished);

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createPollAction(input)
          : await updatePollAction(pollId!, input);

      if (!res.ok) {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="poll-title">Title</Label>
          <Input
            id="poll-title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Team lunch preferences"
            aria-invalid={!!fieldErrors.title}
          />
          {fieldErrors.title && (
            <p role="alert" className="text-sm text-destructive-text">
              {fieldErrors.title.join(" ")}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="poll-desc">Description (optional)</Label>
          <Textarea
            id="poll-desc"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="A short explanation of what this poll is for."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="poll-comment-visibility">Comment visibility</Label>
          <Select
            id="poll-comment-visibility"
            value={draft.commentVisibility}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                commentVisibility: e.target.value as CommentVisibilityInput,
              }))
            }
          >
            {Object.entries(COMMENT_VISIBILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls who can see the optional per-question comments respondents
            leave.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={draft.questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {draft.questions.map((q, i) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  index={i}
                  onChange={(nq) => setQuestion(q.id, nq)}
                  onRemove={() => removeQuestion(q.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {fieldErrors.questions && (
          <p role="alert" className="text-sm text-destructive-text">
            {fieldErrors.questions.join(" ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-4">
        <div className="space-y-2">
          <Label htmlFor="add-type">Add a question</Label>
          <Select
            id="add-type"
            value={addType}
            onChange={(e) => setAddType(e.target.value as QuestionTypeInput)}
            className="w-64"
          >
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={addQuestion}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="cta" onClick={() => submit(true)} disabled={pending}>
          {pending ? "Saving…" : "Save & publish"}
        </Button>
        <Button variant="outline" onClick={() => submit(false)} disabled={pending}>
          Save as draft
        </Button>
        <Button variant="ghost" onClick={() => router.push("/dashboard")} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
