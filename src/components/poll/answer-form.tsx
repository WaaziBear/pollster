"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown } from "lucide-react";
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
  comment: string;
};

function emptyValue(): Value {
  return { selectedOptionIds: [], textValue: "", numberValue: null, comment: "" };
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

  // Reorder a selected option within the rank list (ranked MULTI_CHOICE).
  // dir = -1 moves up (better rank), +1 moves down.
  const moveMulti = (qid: string, optionId: string, dir: -1 | 1) =>
    setValues((v) => {
      const ids = [...v[qid].selectedOptionIds];
      const idx = ids.indexOf(optionId);
      if (idx < 0) return v;
      const target = idx + dir;
      if (target < 0 || target >= ids.length) return v;
      [ids[idx], ids[target]] = [ids[target], ids[idx]];
      return { ...v, [qid]: { ...v[qid], selectedOptionIds: ids } };
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
        comment: values[q.id].comment.trim() || undefined,
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
            onMoveMulti={(optionId, dir) => moveMulti(q.id, optionId, dir)}
            onText={(text) => setValue(q.id, { textValue: text })}
            onNumber={(n) => setValue(q.id, { numberValue: n })}
          />

          <CommentField
            questionId={q.id}
            value={values[q.id].comment}
            disabled={readOnly}
            onChange={(text) => setValue(q.id, { comment: text })}
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

const COMMENT_MAX_LENGTH = 1000;

/** Optional free-text comment attached to any question. */
function CommentField({
  questionId,
  value,
  disabled,
  onChange,
}: {
  questionId: string;
  value: string;
  disabled: boolean;
  onChange: (text: string) => void;
}) {
  const id = `${questionId}-comment`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        Add a comment (optional)
      </Label>
      <Textarea
        id={id}
        value={value}
        maxLength={COMMENT_MAX_LENGTH}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a comment (optional)"
        className="min-h-[60px]"
      />
      <p className="text-xs text-muted-foreground">
        {value.length}/{COMMENT_MAX_LENGTH}
      </p>
    </div>
  );
}

function QuestionInput({
  question: q,
  value,
  disabled,
  onSelectSingle,
  onToggleMulti,
  onMoveMulti,
  onText,
  onNumber,
}: {
  question: AnswerFormQuestion;
  value: Value;
  disabled: boolean;
  onSelectSingle: (optionId: string) => void;
  onToggleMulti: (optionId: string, checked: boolean) => void;
  onMoveMulti: (optionId: string, dir: -1 | 1) => void;
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
      const ranked = q.config?.ranked === true;
      const optionById = new Map(q.options.map((o) => [o.id, o]));
      const selected = value.selectedOptionIds;
      return (
        <div className="grid gap-3">
          <div className="grid gap-2" role="group" aria-label={q.prompt}>
            {maxSelections && (
              <p className="text-xs text-muted-foreground">
                Select up to {maxSelections}.
              </p>
            )}
            {q.options.map((o) => {
              const checked = selected.includes(o.id);
              const atLimit =
                !!maxSelections && !checked && selected.length >= maxSelections;
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

          {ranked && selected.length > 0 && (
            <div className="grid gap-2 rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Rank your selected options
              </p>
              <ol className="grid gap-2" role="list">
                {selected.map((id, i) => {
                  const label = optionById.get(id)?.label ?? id;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-md border bg-background p-2 text-sm"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1">{label}</span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={disabled || i === 0}
                          aria-label={`Move ${label} up`}
                          onClick={() => onMoveMulti(id, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={disabled || i === selected.length - 1}
                          aria-label={`Move ${label} down`}
                          onClick={() => onMoveMulti(id, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
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
