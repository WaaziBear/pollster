import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth-guards";
import { displayNameFromEmail } from "@/lib/utils";
import type { CommentVisibility } from "@prisma/client";

/** Polls created by the user, with counts for the dashboard cards. */
export async function getMyPolls(userId: string) {
  const polls = await prisma.poll.findMany({
    where: { creatorId: userId },
    include: {
      _count: { select: { questions: true, invites: true, responses: true } },
      // Whether the owner has answered their own (published) poll — drives the
      // Answer vs "View / update answer" CTA on the dashboard card.
      responses: {
        where: { respondentId: userId },
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return polls.map((p) => ({
    ...p,
    hasResponded: p.responses.length > 0,
  }));
}

/**
 * Polls shared with the user via a non-revoked invite (matched by userId OR
 * email), excluding their own polls, only published. Includes a flag for
 * whether the user has already responded (drives Answer vs Edit CTA).
 */
export async function getSharedPolls(userId: string, email: string) {
  const polls = await prisma.poll.findMany({
    where: {
      isPublished: true,
      creatorId: { not: userId },
      invites: {
        some: {
          status: { not: "REVOKED" },
          OR: [{ userId }, { email }],
        },
      },
    },
    include: {
      creator: { select: { email: true, name: true } },
      _count: { select: { questions: true } },
      responses: {
        where: { respondentId: userId },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return polls.map((p) => ({
    ...p,
    hasResponded: p.responses.length > 0,
  }));
}

/**
 * Load a poll (with questions + options) for a respondent, applying the access
 * filter directly in the query. Returns null when the user is not authorized,
 * so an unauthorized caller can never read another poll's questions.
 * Also returns any existing response so the form can be pre-filled (edit-in-place).
 */
export async function getPollForRespondent(pollId: string, user: SessionUser) {
  const poll = await prisma.poll.findFirst({
    where: {
      id: pollId,
      OR: [
        { creatorId: user.id },
        {
          isPublished: true,
          invites: {
            some: {
              status: { not: "REVOKED" },
              OR: [{ userId: user.id }, { email: user.email }],
            },
          },
        },
      ],
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
      creator: { select: { email: true, name: true } },
    },
  });

  if (!poll) return null;

  const existingResponse = await prisma.response.findUnique({
    where: { pollId_respondentId: { pollId, respondentId: user.id } },
    include: {
      // Order selected options by rank so re-editing a ranked MULTI_CHOICE
      // answer preserves the previously chosen order (NULL ranks sort first,
      // which is fine for non-ranked questions).
      answers: {
        include: { selectedOptions: { orderBy: { rank: "asc" } } },
      },
    },
  });

  return { poll, existingResponse, isOwner: poll.creatorId === user.id };
}

/** A single visible comment, attributed unless the poll mode strips identity. */
export type VisibleComment = {
  comment: string;
  author: { id: string; name: string } | null;
};

export type VisibleComments = {
  mode: CommentVisibility;
  byQuestion: Record<string, VisibleComment[]>;
};

/**
 * Server-side comment visibility resolver — the single source of truth for who
 * may see per-question comments and how they are attributed.
 *
 * Access is gated behind the SAME filter as getPollForRespondent (owner OR a
 * published poll with a non-revoked invite); an unauthorized viewer gets null
 * and never learns a comment exists.
 *
 * Attribution by poll mode:
 *   - ANONYMOUS: comments visible to everyone who can view the poll, but the
 *     author id/email NEVER leaves the server (author = null for all viewers,
 *     including the owner).
 *   - EDITORS (default): owner-only. Non-owners receive an EMPTY map — comments
 *     are never sent to the client for non-owners.
 *   - EVERYONE: authored (name = email local-part, id = user id). Gating of
 *     peer visibility (respondent must have submitted first) is enforced by the
 *     caller; the owner always sees comments on results.
 */
export async function getVisibleComments(
  pollId: string,
  viewer: SessionUser
): Promise<VisibleComments | null> {
  const poll = await prisma.poll.findFirst({
    where: {
      id: pollId,
      OR: [
        { creatorId: viewer.id },
        {
          isPublished: true,
          invites: {
            some: {
              status: { not: "REVOKED" },
              OR: [{ userId: viewer.id }, { email: viewer.email }],
            },
          },
        },
      ],
    },
    select: { creatorId: true, commentVisibility: true },
  });

  if (!poll) return null;

  const mode = poll.commentVisibility;
  const isOwner = poll.creatorId === viewer.id;

  // EDITORS: owner-only. Never send comments to non-owners.
  if (mode === "EDITORS" && !isOwner) {
    return { mode, byQuestion: {} };
  }

  const answers = await prisma.answer.findMany({
    where: { comment: { not: null }, response: { pollId } },
    select: {
      questionId: true,
      comment: true,
      response: {
        select: { respondent: { select: { id: true, email: true } } },
      },
    },
  });

  const byQuestion: Record<string, VisibleComment[]> = {};
  for (const a of answers) {
    const text = a.comment?.trim();
    if (!text) continue;
    // In ANONYMOUS, id/email MUST NOT leave the server.
    const author =
      mode === "ANONYMOUS"
        ? null
        : {
            id: a.response.respondent.id,
            name: displayNameFromEmail(a.response.respondent.email),
          };
    (byQuestion[a.questionId] ??= []).push({ comment: text, author });
  }

  return { mode, byQuestion };
}

/** Owner-only: full poll for editing. */
export async function getPollForEdit(pollId: string) {
  return prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });
}

/** Owner-only: invites for a poll's management page. */
export async function getPollInvites(pollId: string) {
  return prisma.invite.findMany({
    where: { pollId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Resolve an invite by its opaque token. Returns only the fields needed to
 * route the user; the token alone is NOT access — callers must still pass
 * `canAccessPoll` for the resolved poll.
 */
export async function getInviteByToken(token: string) {
  return prisma.invite.findUnique({
    where: { token },
    select: { pollId: true, email: true, status: true },
  });
}

/**
 * Owner-only: aggregate results for a poll.
 * - choice types: count per option
 * - RATING: count, average, and distribution
 * - FREE_TEXT: list of raw responses
 */
export async function getResults(pollId: string) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: {
            orderBy: { order: "asc" },
            include: {
              _count: { select: { answerLinks: true } },
              // Ranks per selection (only meaningful for ranked MULTI_CHOICE).
              answerLinks: { select: { rank: true } },
            },
          },
          answers: {
            select: { textValue: true, numberValue: true },
          },
        },
      },
      _count: { select: { responses: true } },
    },
  });

  if (!poll) return null;

  const questions = poll.questions.map((q) => {
    if (q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") {
      const config = (q.config as Record<string, unknown> | null) ?? {};
      const ranked = q.type === "MULTI_CHOICE" && config.ranked === true;

      if (ranked) {
        // Ranked MULTI_CHOICE: per-option selection count + mean of non-null ranks.
        const options = q.options.map((o) => {
          const ranks = o.answerLinks
            .map((l) => l.rank)
            .filter((r): r is number => r !== null && r !== undefined);
          const count = o._count.answerLinks;
          return {
            id: o.id,
            label: o.label,
            count,
            averageRank: ranks.length
              ? ranks.reduce((s, r) => s + r, 0) / ranks.length
              : null,
          };
        });
        return { ...stripQuestion(q), kind: "rankedChoice" as const, options };
      }

      const options = q.options.map((o) => ({
        id: o.id,
        label: o.label,
        count: o._count.answerLinks,
      }));
      const total = options.reduce((s, o) => s + o.count, 0);
      return { ...stripQuestion(q), kind: "choice" as const, options, total };
    }
    if (q.type === "RATING") {
      const nums = q.answers
        .map((a) => a.numberValue)
        .filter((n): n is number => n !== null && n !== undefined);
      const sum = nums.reduce((s, n) => s + n, 0);
      const distribution: Record<number, number> = {};
      for (const n of nums) distribution[n] = (distribution[n] ?? 0) + 1;
      return {
        ...stripQuestion(q),
        kind: "rating" as const,
        count: nums.length,
        average: nums.length ? sum / nums.length : 0,
        distribution,
      };
    }
    // FREE_TEXT
    const texts = q.answers
      .map((a) => a.textValue)
      .filter((t): t is string => !!t && t.trim().length > 0);
    return { ...stripQuestion(q), kind: "text" as const, texts };
  });

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    responseCount: poll._count.responses,
    questions,
  };
}

function stripQuestion(q: {
  id: string;
  prompt: string;
  type: string;
  required: boolean;
  order: number;
}) {
  return {
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    required: q.required,
    order: q.order,
  };
}
