import ExcelJS from "exceljs";
import { displayNameFromEmail } from "@/lib/utils";

/**
 * Pure, DB-free builder for the poll-results Excel workbook. All inputs are
 * plain data (structurally compatible with getResults / getVisibleComments /
 * getResponsesForExport) so this module is fully unit-testable without Prisma.
 *
 * SECURITY: comment handling honors the poll's visibility policy exactly:
 *   - ANONYMOUS  -> Responses sheet OMITS all comment columns (a per-respondent
 *                   row + comment would de-anonymize the author); Summary shows
 *                   comments un-attributed ("Anonymous").
 *   - EDITORS    -> owner-only comments included with attribution.
 *   - EVERYONE   -> comments included with attribution.
 */

export type CommentVisibility = "ANONYMOUS" | "EDITORS" | "EVERYONE";

/** Aggregated per-question result kinds (mirrors getResults). */
export type ResultQuestion =
  | {
      id: string;
      prompt: string;
      type: string;
      kind: "choice";
      options: { id: string; label: string; count: number }[];
      total: number;
    }
  | {
      id: string;
      prompt: string;
      type: string;
      kind: "rankedChoice";
      options: {
        id: string;
        label: string;
        count: number;
        averageRank: number | null;
      }[];
    }
  | {
      id: string;
      prompt: string;
      type: string;
      kind: "rating";
      count: number;
      average: number;
      distribution: Record<number, number>;
    }
  | { id: string; prompt: string; type: string; kind: "text"; texts: string[] };

export type ResultsInput = {
  title: string;
  questions: ResultQuestion[];
};

export type VisibleCommentInput = {
  comment: string;
  author: { id: string; name: string } | null;
};

export type CommentsInput = {
  mode: CommentVisibility;
  byQuestion: Record<string, VisibleCommentInput[]>;
};

export type ResponseAnswerInput = {
  questionId: string;
  textValue: string | null;
  numberValue: number | null;
  comment: string | null;
  selectedOptions: {
    rank: number | null;
    option: { id: string; label: string };
  }[];
};

export type ResponseInput = {
  id: string;
  submittedAt: Date | string;
  respondent: { id: string; email: string };
  answers: ResponseAnswerInput[];
};

export type BuildResultsWorkbookInput = {
  poll: { title: string; commentVisibility: CommentVisibility };
  results: ResultsInput;
  comments: CommentsInput;
  responses: ResponseInput[];
};

/** Sort ranked options by average rank ascending; never-chosen (null) last. */
function sortByAverageRank<T extends { averageRank: number | null }>(
  options: T[]
): T[] {
  return [...options].sort((a, b) => {
    if (a.averageRank === null && b.averageRank === null) return 0;
    if (a.averageRank === null) return 1;
    if (b.averageRank === null) return -1;
    return a.averageRank - b.averageRank;
  });
}

/** Attribution label for a Summary comment row. */
function attributionLabel(author: { id: string; name: string } | null): string {
  return author ? `${author.name} (#${author.id})` : "Anonymous";
}

function submittedAtString(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/** Render one respondent's answer cell for a given result question. */
function renderAnswerCell(
  q: ResultQuestion,
  answer: ResponseAnswerInput | undefined
): string | number | null {
  if (!answer) return null;

  switch (q.kind) {
    case "choice":
      // SINGLE_CHOICE -> the one label; unranked MULTI_CHOICE -> joined labels.
      return answer.selectedOptions.map((s) => s.option.label).join("; ");
    case "rankedChoice": {
      // Ranked MULTI_CHOICE -> "1. A; 2. C" in rank order (nulls last).
      const ordered = [...answer.selectedOptions].sort((a, b) => {
        if (a.rank === null && b.rank === null) return 0;
        if (a.rank === null) return 1;
        if (b.rank === null) return -1;
        return a.rank - b.rank;
      });
      return ordered
        .map((s) => (s.rank !== null ? `${s.rank}. ${s.option.label}` : s.option.label))
        .join("; ");
    }
    case "rating":
      return answer.numberValue ?? null;
    case "text":
      return answer.textValue ?? "";
    default:
      return null;
  }
}

export function buildResultsWorkbook({
  poll,
  results,
  comments,
  responses,
}: BuildResultsWorkbookInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pollster";
  wb.created = new Date();

  // ----- Summary sheet ------------------------------------------------------
  const summary = wb.addWorksheet("Summary");
  summary.addRow([poll.title]);
  summary.getRow(1).font = { bold: true, size: 14 };
  summary.addRow([]);

  results.questions.forEach((q, i) => {
    summary.addRow([`${i + 1}. ${q.prompt}`]);

    if (q.kind === "choice") {
      summary.addRow(["Option", "Count", "Percent"]);
      for (const o of q.options) {
        const pct = q.total > 0 ? Math.round((o.count / q.total) * 100) : 0;
        summary.addRow([o.label, o.count, `${pct}%`]);
      }
      if (q.options.length === 0) summary.addRow(["No options."]);
    } else if (q.kind === "rankedChoice") {
      summary.addRow(["Option", "Count", "Average rank"]);
      for (const o of sortByAverageRank(q.options)) {
        summary.addRow([
          o.label,
          o.count,
          o.averageRank !== null ? Number(o.averageRank.toFixed(2)) : "—",
        ]);
      }
      if (q.options.length === 0) summary.addRow(["No options."]);
    } else if (q.kind === "rating") {
      summary.addRow([
        `Average: ${q.count > 0 ? q.average.toFixed(2) : "—"} (${q.count} responses)`,
      ]);
      summary.addRow(["Value", "Count"]);
      const entries = Object.entries(q.distribution)
        .map(([k, v]) => [Number(k), v] as const)
        .sort((a, b) => a[0] - b[0]);
      for (const [value, count] of entries) summary.addRow([value, count]);
      if (entries.length === 0) summary.addRow(["No ratings yet."]);
    } else {
      // text
      if (q.texts.length === 0) {
        summary.addRow(["No responses yet."]);
      } else {
        for (const t of q.texts) summary.addRow([t]);
      }
    }

    // Comments for this question (attribution per visibility policy).
    const qComments = comments.byQuestion[q.id] ?? [];
    if (qComments.length > 0) {
      summary.addRow(["Comments"]);
      for (const c of qComments) {
        summary.addRow([attributionLabel(c.author), c.comment]);
      }
    }

    summary.addRow([]);
  });

  // ----- Responses sheet ----------------------------------------------------
  const responsesSheet = wb.addWorksheet("Responses");
  // ANONYMOUS: per-respondent comment columns are forbidden (de-anonymizing).
  const includeComments = poll.commentVisibility !== "ANONYMOUS";

  const header: string[] = ["Respondent", "Email", "User ID", "Submitted At"];
  results.questions.forEach((q, i) => {
    header.push(q.prompt);
    if (includeComments) header.push(`Q${i + 1} comment`);
  });
  responsesSheet.addRow(header);
  responsesSheet.getRow(1).font = { bold: true };

  for (const r of responses) {
    const byQuestion = new Map(r.answers.map((a) => [a.questionId, a]));
    const row: (string | number | null)[] = [
      displayNameFromEmail(r.respondent.email),
      r.respondent.email,
      r.respondent.id,
      submittedAtString(r.submittedAt),
    ];
    for (const q of results.questions) {
      const answer = byQuestion.get(q.id);
      row.push(renderAnswerCell(q, answer));
      if (includeComments) row.push(answer?.comment ?? "");
    }
    responsesSheet.addRow(row);
  }

  return wb;
}
