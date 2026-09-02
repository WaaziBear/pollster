import { NextResponse } from "next/server";
import {
  getSessionUser,
  requirePollOwner,
  AuthorizationError,
} from "@/lib/auth-guards";
import {
  getResults,
  getVisibleComments,
  getResponsesForExport,
} from "@/lib/queries/polls";
import {
  buildResultsWorkbook,
  type CommentsInput,
} from "@/lib/export/results-workbook";

// exceljs writes an XLSX buffer server-side; requires the Node.js runtime.
export const runtime = "nodejs";

/** Sanitize a poll title into a safe filename slug. */
function safeFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "poll";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Owner-only. On failure return 404 to avoid leaking poll existence
  // (matches the results page convention).
  try {
    await requirePollOwner(id, user);
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return new NextResponse("Not found", { status: 404 });
    }
    throw e;
  }

  const results = await getResults(id);
  if (!results) {
    return new NextResponse("Not found", { status: 404 });
  }

  const visibleComments = await getVisibleComments(id, user);
  const comments: CommentsInput = visibleComments ?? {
    mode: "EDITORS",
    byQuestion: {},
  };

  const data = await getResponsesForExport(id, user);

  const workbook = buildResultsWorkbook({
    poll: { title: results.title, commentVisibility: data.commentVisibility },
    results,
    comments,
    responses: data.responses,
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pollster-${safeFilename(
        results.title
      )}-results.xlsx"`,
    },
  });
}
