"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import type { ActionResult } from "@/types/actions";

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    loginAction,
    undefined
  );

  useEffect(() => {
    if (state?.ok) {
      router.push("/dashboard");
      router.refresh();
    }
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
          autoComplete="current-password"
          required
          aria-invalid={!!fe.password}
          aria-describedby="password-error"
        />
        <FieldError id="password-error" messages={fe.password} />
      </div>

      <Button type="submit" variant="cta" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Log in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
