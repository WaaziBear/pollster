import type { QuestionTypeInput, CommentVisibilityInput } from "@/lib/validation/poll";
import { arrayMove } from "@dnd-kit/sortable";

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
  // When true + published, anyone with the link (signed in) can answer.
  isPublic: boolean;
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

/**
 * Move the question identified by `activeId` to the slot of `overId`, returning
 * a NEW array (never mutates). Used by the poll builder's drag-to-reorder
 * (dnd-kit onDragEnd). If either id is missing or they are the same, the
 * original array is returned unchanged. Question `order` is derived from array
 * index at save time, so reordering here is the whole feature.
 */
export function reorderQuestions(
  questions: DraftQuestion[],
  activeId: string,
  overId: string
): DraftQuestion[] {
  if (activeId === overId) return questions;
  const oldIndex = questions.findIndex((q) => q.id === activeId);
  const newIndex = questions.findIndex((q) => q.id === overId);
  if (oldIndex === -1 || newIndex === -1) return questions;
  return arrayMove(questions, oldIndex, newIndex);
}
