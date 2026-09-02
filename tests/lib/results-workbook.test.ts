import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  buildResultsWorkbook,
  type BuildResultsWorkbookInput,
  type CommentVisibility,
} from "@/lib/export/results-workbook";

// --- Shared fixtures --------------------------------------------------------

const results: BuildResultsWorkbookInput["results"] = {
  title: "Team Survey",
  questions: [
    {
      id: "q1",
      prompt: "Pick one",
      type: "SINGLE_CHOICE",
      kind: "choice",
      total: 3,
      options: [
        { id: "o1", label: "A", count: 2 },
        { id: "o2", label: "B", count: 1 },
      ],
    },
    {
      id: "q2",
      prompt: "Rank these",
      type: "MULTI_CHOICE",
      kind: "rankedChoice",
      options: [
        { id: "r1", label: "X", count: 1, averageRank: 2 },
        { id: "r2", label: "Y", count: 2, averageRank: 1 },
      ],
    },
    {
      id: "q3",
      prompt: "Rate it",
      type: "RATING",
      kind: "rating",
      count: 3,
      average: 3,
      distribution: { 5: 1, 2: 2 },
    },
    {
      id: "q4",
      prompt: "Any thoughts?",
      type: "FREE_TEXT",
      kind: "text",
      texts: ["hello", "world"],
    },
  ],
};

const responses: BuildResultsWorkbookInput["responses"] = [
  {
    id: "resp1",
    submittedAt: new Date("2026-01-01T10:00:00.000Z"),
    respondent: { id: "u1", email: "alice@example.com" },
    answers: [
      {
        questionId: "q1",
        textValue: null,
        numberValue: null,
        comment: null,
        selectedOptions: [{ rank: null, option: { id: "o1", label: "A" } }],
      },
      {
        questionId: "q2",
        textValue: null,
        numberValue: null,
        comment: null,
        // Deliberately out of order to prove rank-sorting in the cell renderer.
        selectedOptions: [
          { rank: 2, option: { id: "r1", label: "X" } },
          { rank: 1, option: { id: "r2", label: "Y" } },
        ],
      },
      {
        questionId: "q3",
        textValue: null,
        numberValue: 5,
        comment: null,
        selectedOptions: [],
      },
      {
        questionId: "q4",
        textValue: "hello",
        numberValue: null,
        comment: "alice note",
        selectedOptions: [],
      },
    ],
  },
  {
    id: "resp2",
    submittedAt: "2026-01-02T10:00:00.000Z",
    respondent: { id: "u2", email: "bob@work.io" },
    answers: [
      {
        questionId: "q1",
        textValue: null,
        numberValue: null,
        comment: "bob note",
        selectedOptions: [{ rank: null, option: { id: "o2", label: "B" } }],
      },
    ],
  },
];

function commentsInput(mode: CommentVisibility): BuildResultsWorkbookInput["comments"] {
  return {
    mode,
    byQuestion: {
      q1: [
        {
          comment: "great question",
          author: mode === "ANONYMOUS" ? null : { id: "u-alice", name: "alice" },
        },
      ],
    },
  };
}

// --- Helpers ----------------------------------------------------------------

function flattenSheet(ws: ExcelJS.Worksheet): string[] {
  const rows = ws.getSheetValues() as unknown[][];
  const out: string[] = [];
  for (const row of rows) {
    if (!row) continue;
    for (const cell of row) {
      if (cell === null || cell === undefined) continue;
      out.push(String(cell));
    }
  }
  return out;
}

function headerOf(ws: ExcelJS.Worksheet): string[] {
  const values = ws.getRow(1).values as unknown[];
  return values.slice(1).map((v) => String(v));
}

function rowValues(ws: ExcelJS.Worksheet, rowNumber: number): (string | number)[] {
  const values = ws.getRow(rowNumber).values as unknown[];
  return values.slice(1).map((v) => (typeof v === "number" ? v : String(v)));
}

// --- Summary sheet ----------------------------------------------------------

describe("buildResultsWorkbook — Summary sheet", () => {
  it("renders each result kind and ranks by average rank ascending", () => {
    const wb = buildResultsWorkbook({
      poll: { title: "Team Survey", commentVisibility: "EVERYONE" },
      results,
      comments: commentsInput("EVERYONE"),
      responses,
    });
    const summary = wb.getWorksheet("Summary")!;
    expect(summary).toBeDefined();
    const flat = flattenSheet(summary);

    // Title + prompts present.
    expect(flat).toContain("Team Survey");
    expect(flat).toContain("1. Pick one");
    expect(flat).toContain("3. Rate it");

    // choice option labels + counts (2/3 -> 67%, 1/3 -> 33%).
    expect(flat).toContain("A");
    expect(flat).toContain("67%");
    expect(flat).toContain("33%");

    // rating average line + text answers.
    expect(flat.some((c) => c.startsWith("Average:"))).toBe(true);
    expect(flat).toContain("hello");
    expect(flat).toContain("world");

    // Ranked sorted: Y (avgRank 1) must appear before X (avgRank 2).
    const yIdx = flat.indexOf("Y");
    const xIdx = flat.indexOf("X");
    expect(yIdx).toBeGreaterThanOrEqual(0);
    expect(xIdx).toBeGreaterThan(yIdx);
  });

  it("EVERYONE/EDITORS: attributes Summary comments as 'name (#id)'", () => {
    for (const mode of ["EVERYONE", "EDITORS"] as const) {
      const wb = buildResultsWorkbook({
        poll: { title: "Team Survey", commentVisibility: mode },
        results,
        comments: commentsInput(mode),
        responses,
      });
      const flat = flattenSheet(wb.getWorksheet("Summary")!);
      expect(flat).toContain("great question");
      expect(flat).toContain("alice (#u-alice)");
      expect(flat).not.toContain("Anonymous");
    }
  });

  it("ANONYMOUS: shows Summary comments un-attributed ('Anonymous', no id/email)", () => {
    const wb = buildResultsWorkbook({
      poll: { title: "Team Survey", commentVisibility: "ANONYMOUS" },
      results,
      comments: commentsInput("ANONYMOUS"),
      responses,
    });
    const flat = flattenSheet(wb.getWorksheet("Summary")!);
    expect(flat).toContain("great question");
    expect(flat).toContain("Anonymous");
    expect(flat).not.toContain("alice (#u-alice)");
    expect(flat.join("|")).not.toContain("u-alice");
  });
});

// --- Responses sheet --------------------------------------------------------

describe("buildResultsWorkbook — Responses sheet", () => {
  it("has expected headers + one row per respondent with rendered answers (ranked ordering)", () => {
    const wb = buildResultsWorkbook({
      poll: { title: "Team Survey", commentVisibility: "EVERYONE" },
      results,
      comments: commentsInput("EVERYONE"),
      responses,
    });
    const sheet = wb.getWorksheet("Responses")!;

    const header = headerOf(sheet);
    expect(header.slice(0, 4)).toEqual([
      "Respondent",
      "Email",
      "User ID",
      "Submitted At",
    ]);
    // Comment columns present + interleaved per question.
    expect(header).toContain("Q1 comment");
    expect(header).toContain("Q4 comment");

    // One header row + two respondent rows.
    expect(sheet.rowCount).toBe(3);

    const row1 = rowValues(sheet, 2);
    expect(row1[0]).toBe("alice"); // displayNameFromEmail
    expect(row1[1]).toBe("alice@example.com");
    expect(row1[2]).toBe("u1");
    expect(row1[3]).toBe("2026-01-01T10:00:00.000Z");
    // Ranked cell rendered in rank order regardless of input order.
    expect(row1).toContain("1. Y; 2. X");
    // Single choice label, rating number, free-text value + its comment.
    expect(row1).toContain("A");
    expect(row1).toContain(5);
    expect(row1).toContain("hello");
    expect(row1).toContain("alice note");
  });

  it("ANONYMOUS: OMITS all comment columns from the Responses sheet", () => {
    const wb = buildResultsWorkbook({
      poll: { title: "Team Survey", commentVisibility: "ANONYMOUS" },
      results,
      comments: commentsInput("ANONYMOUS"),
      responses,
    });
    const sheet = wb.getWorksheet("Responses")!;
    const header = headerOf(sheet);

    // 4 fixed columns + exactly one column per question, no comment columns.
    expect(header).toHaveLength(4 + results.questions.length);
    expect(header.some((h) => h.endsWith(" comment"))).toBe(false);

    // Per-respondent comment text must never appear (would de-anonymize).
    const flat = flattenSheet(sheet);
    expect(flat).not.toContain("alice note");
    expect(flat).not.toContain("bob note");
  });
});


// --- Serialized (.xlsx round-trip) security -------------------------------
// The other tests inspect the in-memory worksheet model. An .xlsx is a zipped
// archive, so these tests serialize to a real buffer and load it back to prove
// the *written file* honors the anonymity contract.

describe("buildResultsWorkbook — serialized ANONYMOUS workbook", () => {
  async function roundTrip(
    input: BuildResultsWorkbookInput
  ): Promise<ExcelJS.Workbook> {
    const wb = buildResultsWorkbook(input);
    const buffer = await wb.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer as ArrayBuffer);
    return loaded;
  }

  function allCells(ws: ExcelJS.Worksheet): string[] {
    const out: string[] = [];
    ws.eachRow((row) => {
      (row.values as unknown[]).forEach((c) => {
        if (c !== null && c !== undefined) out.push(String(c));
      });
    });
    return out;
  }

  it("Responses sheet: no comment columns and no per-respondent comment text survives serialization", async () => {
    const loaded = await roundTrip({
      poll: { title: "Team Survey", commentVisibility: "ANONYMOUS" },
      results,
      comments: commentsInput("ANONYMOUS"),
      responses,
    });
    const sheet = loaded.getWorksheet("Responses")!;
    const header = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((v) => String(v));
    expect(header).toHaveLength(4 + results.questions.length);
    expect(header.some((h) => h.endsWith(" comment"))).toBe(false);

    const cells = allCells(sheet);
    // Per-respondent answer comments must never appear (would de-anonymize).
    expect(cells).not.toContain("alice note");
    expect(cells).not.toContain("bob note");
  });

  it("Summary sheet: comment author id/email is absent from the serialized bytes", async () => {
    const loaded = await roundTrip({
      poll: { title: "Team Survey", commentVisibility: "ANONYMOUS" },
      results,
      comments: commentsInput("ANONYMOUS"),
      responses,
    });
    const summaryCells = allCells(loaded.getWorksheet("Summary")!);
    expect(summaryCells).toContain("Anonymous");
    // The comment author identity must not leak in any form.
    expect(summaryCells.join("|")).not.toContain("u-alice");
    expect(summaryCells.join("|")).not.toContain("alice (#");
  });
});
