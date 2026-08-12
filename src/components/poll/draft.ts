import type { QuestionTypeInput } from "@/lib/validation/poll";

export type DraftOption = { id: string; label: string };

export type DraftQuestion = {
  id: string; // client-only key
  type: QuestionTypeInput;
  prompt: string;
  required: boolean;
  options: DraftOption[]; // choice types
  // config
  ratingMin: number;
  ratingMax: number;
  maxLength?: number;
  maxSelections?: number;
};

export type DraftPoll = {
  title: string;
  description: string;
  questions: DraftQuestion[];
};

export const QUESTION_TYPE_LABELS: Record<QuestionTypeInput, string> = {
  SINGLE_CHOICE: "Single choice (radio)",
  MULTI_CHOICE: "Multiple choice (checkbox)",
  FREE_TEXT: "Free text (short answer)",
  RATING: "Rating / scale",
};

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function newQuestion(type: QuestionTypeInput = "SINGLE_CHOICE"): DraftQuestion {
  return {
    id: uid("q"),
    type,
    prompt: "",
    required: false,
    options:
      type === "SINGLE_CHOICE" || type === "MULTI_CHOICE"
        ? [
            { id: uid("o"), label: "" },
            { id: uid("o"), label: "" },
          ]
        : [],
    ratingMin: 1,
    ratingMax: 5,
    maxLength: 500,
  };
}
