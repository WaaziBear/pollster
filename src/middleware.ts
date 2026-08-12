import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe middleware: uses only the partial config (no Prisma/bcrypt).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect app routes; exclude static assets, image optimizer, and the
  // NextAuth API route. Auth pages are handled by the `authorized` callback.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
