"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field-error";
import { grantAccessAction, revokeAccessAction } from "@/actions/grant.actions";

export type GrantRole = "EDITOR" | "RESULTS_VIEWER";

export type GrantRow = {
  id: string;
  email: string;
  role: GrantRole;
  userId: string | null;
};

const ROLE_LABEL: Record<GrantRole, string> = {
  EDITOR: "Editor",
  RESULTS_VIEWER: "Results viewer",
};

export function AccessManager({
  pollId,
  grants,
}: {
  pollId: string;
  grants: GrantRow[];
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [role, setRole] = useState<GrantRole>("EDITOR");
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
      const res = await grantAccessAction(pollId, emails, role);
      if (!res.ok) {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      setRaw("");
      setMessage(`Granted access to ${res.data?.granted ?? emails.length} email(s).`);
      router.refresh();
    });
  };

  const revoke = (accessId: string) => {
    startTransition(async () => {
      const res = await revokeAccessAction(accessId);
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
          <Label htmlFor="grant-emails">Grant access by email</Label>
          <Textarea
            id="grant-emails"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="alice@example.com, bob@example.com"
            aria-describedby="grant-emails-error"
          />
          <p className="text-xs text-muted-foreground">
            Editors can edit the poll, publish, and manage invites. Results
            viewers can view results and export responses. Only you (the owner)
            can delete the poll or manage access.
          </p>
          <FieldError id="grant-emails-error" messages={fieldErrors.emails} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grant-role">Role</Label>
          <Select
            id="grant-role"
            value={role}
            onChange={(e) => setRole(e.target.value as GrantRole)}
            className="w-full sm:w-56"
          >
            <option value="EDITOR">Editor</option>
            <option value="RESULTS_VIEWER">Results viewer</option>
          </Select>
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
          {pending ? "Saving…" : "Grant access"}
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">
          People with access ({grants.length})
        </h2>
        {grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has been granted access yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {grants.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{g.email}</span>
                  <Badge variant={g.role === "EDITOR" ? "default" : "secondary"}>
                    {ROLE_LABEL[g.role]}
                  </Badge>
                  {!g.userId && (
                    <Badge variant="outline">pending signup</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive-text hover:text-destructive-text"
                  onClick={() => revoke(g.id)}
                  disabled={pending}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
