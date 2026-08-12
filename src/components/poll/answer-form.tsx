"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { submitResponseAction } from "@/actions/response.actions";
import type { SubmitResponseInput } from "@/lib/validation/response";

export type AnswerFormQuestion = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "FREE_TEXT" | "RATING";
  prompt: string;
  required: boolean;
  order: number;
  config: Record<string, unknown> | null;
  options: { id: string; label: string }[];
};

/** Per-question working value in the form state. */
type Value = {
  selectedOptionIds: string[];
  textValue: string;
  numberValue: number | null;
};

function emptyValue(): Value {
  return { selectedOptionIds: [], textValue: "", numberValue: null };
}

export function AnswerForm({
  pollId,
  questions,
  initialAnswers,
  readOnly = false,
  hasResponded = false,
}: {
  pollId: string;
  questions: AnswerFormQuestion[];
  initialAnswers: Record<string, Value>;
  readOnly?: boolean;
  hasResponded?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, Value>>(() => {
    const seed: Record<string, Value> = {};
    for (const q of questions) seed[q.id] = initialAnswers[q.id] ?? emptyValue();
    return seed;
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const setValue = (qid: string, patch: Partial<Value>) =>
    setValues((v) => ({ ...v, [qid]: { ...v[qid], ...patch } }));

  const toggleMulti = (qid: string, optionId: string, checked: boolean) =>
    setValues((v) => {
      const current = v[qid].selectedOptionIds;
      const next = checked
        ? Array.from(new Set([...current, optionId]))
        : current.filter((id) => id !== optionId);
      return { ...v, [qid]: { ...v[qid], selectedOptionIds: next } };
    });

  const submit = () => {
    setError(null);
    setFieldErrors({});
    setDone(false);

    const input: SubmitResponseInput = {
      pollId,
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedOptionIds: values[q.id].selectedOptionIds,
        textValue: values[q.id].textValue || undefined,
        numberValue:
          values[q.id].numberValue === null ? undefined : values[q.id].numberValue!,
      })),
    };

    startTransition(async () => {
      const res = await submitResponseAction(input);
      if (!res.ok) {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      setDone(true);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {questions.map((q, i) => (
        <div key={q.id} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {i + 1}.
            </span>
            <Label className="text-base">
              {q.prompt}
              {q.required && <span className="ml-1 text-destructive-text">*</span>}
            </Label>
          </div>

          <QuestionInput
            question={q}
            value={values[q.id]}
            disabled={readOnly}
            onSelectSingle={(optionId) =>
              setValue(q.id, { selectedOptionIds: [optionId] })
            }
            onToggleMulti={(optionId, checked) =>
              toggleMulti(q.id, optionId, checked)
            }
            onText={(text) => setValue(q.id, { textValue: text })}
            onNumber={(n) => setValue(q.id, { numberValue: n })}
          />

          <FieldError messages={fieldErrors[q.id]} />
        </div>
      ))}

      {error && (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm font-medium text-success">
          Your response has been saved.
        </p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <Button variant="cta" onClick={submit} disabled={pending}>
            {pending
              ? "Submitting…"
              : hasResponded
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
      )}
    </div>
  );
}

function QuestionInput({
  question: q,
  value,
  disabled,
  onSelectSingle,
  onToggleMulti,
  onText,
  onNumber,
}: {
  question: AnswerFormQuestion;
  value: Value;
  disabled: boolean;
  onSelectSingle: (optionId: string) => void;
  onToggleMulti: (optionId: string, checked: boolean) => void;
  onText: (text: string) => void;
  onNumber: (n: number) => void;
}) {
  switch (q.type) {
    case "SINGLE_CHOICE":
      return (
        <RadioGroup
          value={value.selectedOptionIds[0] ?? ""}
          onValueChange={onSelectSingle}
          disabled={disabled}
          aria-label={q.prompt}
        >
          {q.options.map((o) => (
            <label
              key={o.id}
              className="flex items-center gap-3 text-sm cursor-pointer"
            >
              <RadioGroupItem value={o.id} id={`${q.id}-${o.id}`} />
              {o.label}
            </label>
          ))}
        </RadioGroup>
      );

    case "MULTI_CHOICE": {
      const maxSelections =
        typeof q.config?.maxSelections === "number"
          ? (q.config.maxSelections as number)
          : undefined;
      return (
        <div className="grid gap-2" role="group" aria-label={q.prompt}>
          {maxSelections && (
            <p className="text-xs text-muted-foreground">
              Select up to {maxSelections}.
            </p>
          )}
          {q.options.map((o) => {
            const checked = value.selectedOptionIds.includes(o.id);
            const atLimit =
              !!maxSelections &&
              !checked &&
              value.selectedOptionIds.length >= maxSelections;
            return (
              <label
                key={o.id}
                className="flex items-center gap-3 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled || atLimit}
                  onCheckedChange={(v) => onToggleMulti(o.id, v === true)}
                  id={`${q.id}-${o.id}`}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      );
    }

    case "FREE_TEXT": {
      const maxLength =
        typeof q.config?.maxLength === "number"
          ? (q.config.maxLength as number)
          : 500;
      return (
        <div className="space-y-1">
          <Textarea
            value={value.textValue}
            maxLength={maxLength}
            disabled={disabled}
            onChange={(e) => onText(e.target.value)}
            placeholder="Your answer"
            aria-label={q.prompt}
          />
          <p className="text-xs text-muted-foreground">
            {value.textValue.length}/{maxLength}
          </p>
        </div>
      );
    }

    case "RATING": {
      const min = typeof q.config?.min === "number" ? (q.config.min as number) : 1;
      const max = typeof q.config?.max === "number" ? (q.config.max as number) : 5;
      const scale: number[] = [];
      for (let n = min; n <= max; n++) scale.push(n);
      return (
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label={q.prompt}
        >
          {scale.map((n) => {
            const selected = value.numberValue === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onNumber(n)}
                className={
                  "flex h-11 w-11 items-center justify-center rounded-md border text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " +
                  (selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent")
                }
              >
                {n}
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
