"use client";

import { Trash2, Plus, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DraftQuestion,
  QUESTION_TYPE_LABELS,
  uid,
  type DraftOption,
} from "./draft";
import type { QuestionTypeInput } from "@/lib/validation/poll";

export function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
  error,
}: {
  question: DraftQuestion;
  index: number;
  onChange: (q: DraftQuestion) => void;
  onRemove: () => void;
  error?: string;
}) {
  const set = (patch: Partial<DraftQuestion>) => onChange({ ...question, ...patch });

  const changeType = (type: QuestionTypeInput) => {
    const needsOptions = type === "SINGLE_CHOICE" || type === "MULTI_CHOICE";
    set({
      type,
      options:
        needsOptions && question.options.length < 2
          ? [
              { id: uid("o"), label: "" },
              { id: uid("o"), label: "" },
            ]
          : question.options,
    });
  };

  const updateOption = (optId: string, label: string) => {
    set({
      options: question.options.map((o) => (o.id === optId ? { ...o, label } : o)),
    });
  };
  const addOption = () =>
    set({ options: [...question.options, { id: uid("o"), label: "" }] });
  const removeOption = (optId: string) =>
    set({ options: question.options.filter((o) => o.id !== optId) });

  const isChoice = question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE";

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">Question {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto text-destructive-text hover:text-destructive-text"
          onClick={onRemove}
          aria-label={`Remove question ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor={`prompt-${question.id}`}>Prompt</Label>
          <Input
            id={`prompt-${question.id}`}
            value={question.prompt}
            onChange={(e) => set({ prompt: e.target.value })}
            placeholder="What is your question?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`type-${question.id}`}>Type</Label>
          <Select
            id={`type-${question.id}`}
            value={question.type}
            onChange={(e) => changeType(e.target.value as QuestionTypeInput)}
          >
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isChoice && (
        <ChoiceOptionsEditor
          options={question.options}
          onUpdate={updateOption}
          onAdd={addOption}
          onRemove={removeOption}
          allowMultiConfig={question.type === "MULTI_CHOICE"}
          maxSelections={question.maxSelections}
          onMaxSelectionsChange={(n) => set({ maxSelections: n })}
        />
      )}

      {question.type === "FREE_TEXT" && (
        <div className="space-y-2 max-w-xs">
          <Label htmlFor={`maxlen-${question.id}`}>Max length</Label>
          <Input
            id={`maxlen-${question.id}`}
            type="number"
            min={1}
            value={question.maxLength ?? 500}
            onChange={(e) => set({ maxLength: Number(e.target.value) })}
          />
        </div>
      )}

      {question.type === "RATING" && (
        <div className="flex gap-4">
          <div className="space-y-2 w-24">
            <Label htmlFor={`min-${question.id}`}>Min</Label>
            <Input
              id={`min-${question.id}`}
              type="number"
              value={question.ratingMin}
              onChange={(e) => set({ ratingMin: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2 w-24">
            <Label htmlFor={`max-${question.id}`}>Max</Label>
            <Input
              id={`max-${question.id}`}
              type="number"
              value={question.ratingMax}
              onChange={(e) => set({ ratingMax: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
        <Checkbox
          checked={question.required}
          onCheckedChange={(v) => set({ required: v === true })}
        />
        Required
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      )}
    </div>
  );
}

function ChoiceOptionsEditor({
  options,
  onUpdate,
  onAdd,
  onRemove,
  allowMultiConfig,
  maxSelections,
  onMaxSelectionsChange,
}: {
  options: DraftOption[];
  onUpdate: (id: string, label: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  allowMultiConfig: boolean;
  maxSelections?: number;
  onMaxSelectionsChange: (n: number | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Options</Label>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
            <Input
              value={o.label}
              onChange={(e) => onUpdate(o.id, e.target.value)}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(o.id)}
              disabled={options.length <= 2}
              aria-label={`Remove option ${i + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Add option
      </Button>

      {allowMultiConfig && (
        <div className="space-y-2 max-w-xs pt-2">
          <Label htmlFor="maxsel">Max selections (optional)</Label>
          <Input
            id="maxsel"
            type="number"
            min={1}
            value={maxSelections ?? ""}
            placeholder="No limit"
            onChange={(e) =>
              onMaxSelectionsChange(
                e.target.value ? Number(e.target.value) : undefined
              )
            }
          />
        </div>
      )}
    </div>
  );
}
