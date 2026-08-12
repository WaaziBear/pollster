"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { signupAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import type { ActionResult } from "@/types/actions";

export function SignupForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    signupAction,
    undefined
  );

  useEffect(() => {
    if (state?.ok) router.push("/dashboard");
  }, [state, router]);

  const fe = (state && !state.ok && state.fieldErrors) || {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && !state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive-text">
          {state.error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!fe.email}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" messages={fe.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!fe.password}
          aria-describedby="password-error"
        />
        <FieldError id="password-error" messages={fe.password} />
        <p className="text-xs text-muted-foreground">
          At least 8 characters, including a letter and a number.
        </p>
      </div>

      <Button type="submit" variant="cta" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
