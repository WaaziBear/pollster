import type { QuestionTypeInput, CommentVisibilityInput } from "@/lib/validation/poll";

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
  ranked?: boolean; // MULTI_CHOICE: opt-in ranking of selected options
};

export type DraftPoll = {
  title: string;
  description: string;
  commentVisibility: CommentVisibilityInput;
  questions: DraftQuestion[];
};

export const QUESTION_TYPE_LABELS: Record<QuestionTypeInput, string> = {
  SINGLE_CHOICE: "Single choice (radio)",
  MULTI_CHOICE: "Multiple choice (checkbox)",
  FREE_TEXT: "Free text (short answer)",
  RATING: "Rating / scale",
};

/** Human-readable labels for the poll-level comment visibility policy. */
export const COMMENT_VISIBILITY_LABELS: Record<CommentVisibilityInput, string> = {
  ANONYMOUS: "Anonymous — everyone sees comments, authors hidden",
  EDITORS: "Editors only — only you (the owner) see comments",
  EVERYONE: "Everyone — respondents see each other's comments after answering",
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
