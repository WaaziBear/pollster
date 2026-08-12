import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/hash";
import { loginSchema } from "@/lib/validation/auth";
import { normalizeEmail } from "@/lib/utils";

/**
 * Full NextAuth (Auth.js v5) config — runs on the Node.js runtime.
 * Credentials provider verifies email/password against the Postgres `User`
 * table via Prisma + bcrypt. JWT session strategy (required for Credentials).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Trust the deployment host's forwarded headers (X-Forwarded-Host) so
  // Auth.js resolves callback URLs correctly behind Vercel's proxy without
  // hardcoding AUTH_URL. Provider-agnostic for any hosting platform.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        // Validate shape before touching the DB.
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = normalizeEmail(parsed.data.email);
        const user = await prisma.user.findUnique({ where: { email } });
        // Generic failure: never reveal whether email or password was wrong.
        if (!user) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
});
