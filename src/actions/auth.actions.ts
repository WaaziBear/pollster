"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/hash";
import { signupSchema, loginSchema } from "@/lib/validation/auth";
import { normalizeEmail } from "@/lib/utils";
import { linkInvitesToUser, linkGrantsToUser } from "@/lib/invites";
import { rateLimit } from "@/lib/rate-limit";
import { ActionResult, fail, ok } from "@/types/actions";

/**
 * Sign up: validate, reject duplicate email, hash password, create user, link
 * any pending invites, then establish a session. Public action.
 */
export async function signupAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    name: (formData.get("name") as string) ?? "",
    email: (formData.get("email") as string) ?? "",
    password: (formData.get("password") as string) ?? "",
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const email = normalizeEmail(parsed.data.email);

  // Basic anti-abuse rate limiting keyed by email.
  if (!rateLimit(`signup:${email}`, 5, 60_000)) {
    return fail("Too many attempts. Please try again shortly.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return fail("Please fix the errors below.", {
      email: ["An account with this email already exists."],
    });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: parsed.data.name?.trim() || null,
    },
  });

  // Surface any invites that were addressed to this email before signup.
  await linkInvitesToUser(email, user.id);
  // Same for per-poll access grants addressed to this email.
  await linkGrantsToUser(email, user.id);

  // Establish a session. signIn with redirect:false so we can control flow.
  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return fail("Account created, but automatic sign-in failed. Please log in.");
    }
    throw err;
  }

  return ok();
}

/**
 * Login action for the credentials form. Public.
 */
export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: (formData.get("email") as string) ?? "",
    password: (formData.get("password") as string) ?? "",
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const email = normalizeEmail(parsed.data.email);
  if (!rateLimit(`login:${email}`, 10, 60_000)) {
    return fail("Too many attempts. Please try again shortly.");
  }

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // Generic message — never reveal whether email or password was wrong.
      return fail("Invalid email or password.");
    }
    throw err;
  }

  return ok();
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
