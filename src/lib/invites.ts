import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";

/**
 * Link any invites addressed to `email` to a concrete user account.
 * Called at signup (and could be called on login) so invites created before
 * the invitee had an account are surfaced in their "Shared With Me" list.
 *
 * Only PENDING invites are promoted to ACCEPTED; REVOKED invites are left
 * untouched. We match on the normalized email string.
 */
export async function linkInvitesToUser(
  email: string,
  userId: string
): Promise<number> {
  const normalized = normalizeEmail(email);
  const result = await prisma.invite.updateMany({
    where: {
      email: normalized,
      userId: null,
      status: { not: "REVOKED" },
    },
    data: {
      userId,
      status: "ACCEPTED",
    },
  });
  return result.count;
}

/**
 * Link any per-poll access grants addressed to `email` to a concrete user
 * account. Mirrors linkInvitesToUser: called at signup (and on invite-link
 * landing) so grants created before the grantee had an account are surfaced on
 * their dashboard and honored by the guards via userId. Matches on the
 * normalized email string; only unlinked grants are updated.
 */
export async function linkGrantsToUser(
  email: string,
  userId: string
): Promise<number> {
  const normalized = normalizeEmail(email);
  const result = await prisma.pollAccess.updateMany({
    where: {
      email: normalized,
      userId: null,
    },
    data: { userId },
  });
  return result.count;
}

/**
 * Send (or, in local dev, stub) an invite email.
 *
 * Delivery is env-gated: if both `RESEND_API_KEY` and `EMAIL_FROM` are set we
 * send a real email via Resend. Otherwise we fall back to the original dev
 * stub, logging the invite link to the server console. This keeps local dev
 * zero-config while enabling real delivery in production by setting two env
 * vars. Failures never throw into the caller — the invite record is already
 * persisted and authorization does not depend on the email being delivered.
 */
export async function sendInviteEmail(params: {
  email: string;
  pollTitle: string;
  token: string;
  baseUrl: string;
}): Promise<void> {
  const link = `${params.baseUrl}/polls/invite/${params.token}`;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  // Fallback: no provider configured -> log the link (dev-friendly, no secrets).
  if (!apiKey || !from) {
    // eslint-disable-next-line no-console
    console.info(
      `[invite-email:stub] to=${params.email} poll="${params.pollTitle}" link=${link}`
    );
    return;
  }

  try {
    // Imported lazily so environments without the provider configured never
    // need the dependency loaded.
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const subject = `You're invited to the poll "${params.pollTitle}"`;
    const html =
      `<p>You've been invited to respond to the poll ` +
      `<strong>${escapeHtml(params.pollTitle)}</strong>.</p>` +
      `<p><a href="${link}">Open the poll</a></p>` +
      `<p>Or paste this link into your browser:<br>${link}</p>`;
    const text =
      `You've been invited to respond to the poll "${params.pollTitle}".\n\n` +
      `Open the poll: ${link}`;

    const { error } = await resend.emails.send({
      from,
      to: params.email,
      subject,
      html,
      text,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[invite-email] Resend rejected send to=${params.email}: ${error.message}`
      );
    }
  } catch (err) {
    // Network/import/config failure: log and continue. Do NOT log secrets.
    // eslint-disable-next-line no-console
    console.error(
      `[invite-email] failed to send to=${params.email}:`,
      err instanceof Error ? err.message : err
    );
  }
}

/** Minimal HTML-escaping for user-provided text interpolated into the email. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
