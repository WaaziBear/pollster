"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { submitResponseAction } from "@/actions/response.actions";
import type { QuestionTypeInput } from "@/lib/validation/poll";
import type { SubmitResponseInput } from "@/lib/validation/response";

export type ResponseOption = { id: string; label: string };

export type ResponseQuestion = {
  id: string;
  type: QuestionTypeInput;
  prompt: string;
  required: boolean;
  config: Record<string, unknown> | null;
  options: ResponseOption[];
};

export type ExistingAnswer = {
  questionId: string;
  textValue: string | null;
  numberValue: number | null;
  selectedOptionIds: string[];
};

type ChoiceState = Record<string, string[]>;
type TextState = Record<string, string>;
type NumberState = Record<string, number | undefined>;

function buildInitialState(existing: ExistingAnswer[]) {
  const choice: ChoiceState = {};
  const text: TextState = {};
  const number: NumberState = {};
  for (const a of existing) {
    if (a.selectedOptionIds.length) choice[a.questionId] = a.selectedOptionIds;
    if (a.textValue !== null) text[a.questionId] = a.textValue;
    if (a.numberValue !== null) number[a.questionId] = a.numberValue;
  }
  return { choice, text, number };
}

export function PollResponseForm({
  pollId,
  questions,
  existingAnswers,
  alreadyResponded,
}: {
  pollId: string;
  questions: ResponseQuestion[];
  existingAnswers: ExistingAnswer[];
  alreadyResponded: boolean;
}) {
  const router = useRouter();
  const init = buildInitialState(existingAnswers);
  const [choice, setChoice] = useState<ChoiceState>(init.choice);
  const [text, setText] = useState<TextState>(init.text);
  const [number, setNumber] = useState<NumberState>(init.number);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const setSingle = (qId: string, optionId: string) =>
    setChoice((c) => ({ ...c, [qId]: [optionId] }));

  const toggleMulti = (qId: string, optionId: string, checked: boolean) =>
    setChoice((c) => {
      const current = new Set(c[qId] ?? []);
      if (checked) current.add(optionId);
      else current.delete(optionId);
      return { ...c, [qId]: Array.from(current) };
    });

  const submit = () => {
    setError(null);
    setFieldErrors({});
    setSaved(false);

    const answers: SubmitResponseInput["answers"] = questions.map((q) => {
      switch (q.type) {
        case "SINGLE_CHOICE":
        case "MULTI_CHOICE":
          return { questionId: q.id, selectedOptionIds: choice[q.id] ?? [] };
        case "FREE_TEXT":
          return { questionId: q.id, textValue: text[q.id] ?? "" };
        case "RATING":
          return { questionId: q.id, numberValue: number[q.id] };
        default:
          return { questionId: q.id };
      }
    });

    startTransition(async () => {
      const res = await submitResponseAction({ pollId, answers });
      if (!res.ok) {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
          <legend className="sr-only">Question {i + 1}</legend>
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">
              {i + 1}. {q.prompt}
              {q.required && (
                <span className="ml-1 text-destructive-text" aria-hidden>
                  *
                </span>
              )}
            </p>
            {q.required && <Badge variant="outline">Required</Badge>}
          </div>

          <QuestionInput
            question={q}
            selected={choice[q.id] ?? []}
            textValue={text[q.id] ?? ""}
            numberValue={number[q.id]}
            onSingle={(optId) => setSingle(q.id, optId)}
            onMulti={(optId, checked) => toggleMulti(q.id, optId, checked)}
            onText={(v) => setText((t) => ({ ...t, [q.id]: v }))}
            onNumber={(v) => setNumber((n) => ({ ...n, [q.id]: v }))}
          />

          <FieldError messages={fieldErrors[q.id]} />
        </fieldset>
      ))}

      {error && (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-medium text-success">
          Your response has been saved.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="cta" onClick={submit} disabled={pending}>
          {pending
            ? "Saving…"
            : alreadyResponded
              ? "Update my answers"
              : "Submit answers"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          disabled={pending}
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  selected,
  textValue,
  numberValue,
  onSingle,
  onMulti,
  onText,
  onNumber,
}: {
  question: ResponseQuestion;
  selected: string[];
  textValue: string;
  numberValue: number | undefined;
  onSingle: (optionId: string) => void;
  onMulti: (optionId: string, checked: boolean) => void;
  onText: (value: string) => void;
  onNumber: (value: number) => void;
}) {
  const config = question.config ?? {};

  switch (question.type) {
    case "SINGLE_CHOICE":
      return (
        <RadioGroup
          value={selected[0] ?? ""}
          onValueChange={onSingle}
          aria-label={question.prompt}
        >
          {question.options.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <RadioGroupItem value={o.id} id={`${question.id}-${o.id}`} />
              <span>{o.label}</span>
            </label>
          ))}
        </RadioGroup>
      );

    case "MULTI_CHOICE": {
      const maxSel =
        typeof config.maxSelections === "number" ? config.maxSelections : undefined;
      return (
        <div className="space-y-2">
          {maxSel !== undefined && (
            <p className="text-xs text-muted-foreground">
              Select up to {maxSel}.
            </p>
          )}
          {question.options.map((o) => {
            const checked = selected.includes(o.id);
            const atLimit =
              maxSel !== undefined && !checked && selected.length >= maxSel;
            return (
              <label
                key={o.id}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  atLimit ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={atLimit}
                  onCheckedChange={(v) => onMulti(o.id, v === true)}
                />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case "FREE_TEXT": {
      const maxLength =
        typeof config.maxLength === "number" ? config.maxLength : 500;
      return (
        <div className="space-y-1">
          <Label htmlFor={`text-${question.id}`} className="sr-only">
            {question.prompt}
          </Label>
          <Textarea
            id={`text-${question.id}`}
            value={textValue}
            maxLength={maxLength}
            onChange={(e) => onText(e.target.value)}
            placeholder="Type your answer"
          />
          <p className="text-right text-xs text-muted-foreground">
            {textValue.length}/{maxLength}
          </p>
        </div>
      );
    }

    case "RATING": {
      const min = typeof config.min === "number" ? config.min : 1;
      const max = typeof config.max === "number" ? config.max : 5;
      const values: number[] = [];
      for (let v = min; v <= max; v++) values.push(v);
      return (
        <div
          role="radiogroup"
          aria-label={question.prompt}
          className="flex flex-wrap gap-2"
        >
          {values.map((v) => {
            const active = numberValue === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onNumber(v)}
                className={cn(
                  "flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                )}
              >
                {v}
              </button>
            );
          })}
        </div>
      );
    }

    default:
      return null;
  }
}
