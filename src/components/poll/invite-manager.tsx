"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field-error";
import {
  inviteEmailsAction,
  revokeInviteAction,
} from "@/actions/invite.actions";

export type InviteRow = {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  token: string;
};

const STATUS_VARIANT: Record<
  InviteRow["status"],
  "default" | "secondary" | "success" | "destructive"
> = {
  PENDING: "secondary",
  ACCEPTED: "success",
  REVOKED: "destructive",
};

export function InviteManager({
  pollId,
  invites,
}: {
  pollId: string;
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setFieldErrors({});
    setMessage(null);

    // Split on commas / whitespace / newlines; the server re-validates + normalizes.
    const emails = raw
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      setError("Enter at least one email address.");
      return;
    }

    startTransition(async () => {
      const res = await inviteEmailsAction(pollId, emails);
      if (!res.ok) {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      setRaw("");
      setMessage(`Invited ${res.data?.invited ?? emails.length} email(s).`);
      router.refresh();
    });
  };

  const revoke = (inviteId: string) => {
    startTransition(async () => {
      const res = await revokeInviteAction(inviteId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="emails">Invite by email</Label>
          <Textarea
            id="emails"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="alice@example.com, bob@example.com"
            aria-describedby="emails-error"
          />
          <p className="text-xs text-muted-foreground">
            Separate multiple addresses with commas, spaces, or new lines. Only
            invited emails can view and answer this poll.
          </p>
          <FieldError id="emails-error" messages={fieldErrors.emails} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive-text">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm font-medium text-success">
            {message}
          </p>
        )}
        <Button variant="cta" onClick={submit} disabled={pending}>
          {pending ? "Sending…" : "Send invites"}
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">
          Invited people ({invites.length})
        </h2>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has been invited yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{inv.email}</span>
                  <Badge variant={STATUS_VARIANT[inv.status]}>
                    {inv.status.toLowerCase()}
                  </Badge>
                </div>
                {inv.status !== "REVOKED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive-text hover:text-destructive-text"
                    onClick={() => revoke(inv.id)}
                    disabled={pending}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
