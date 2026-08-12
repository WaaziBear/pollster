import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe partial config shared by middleware and the full server config.
 * Contains NO database or password-hashing imports so it can run on the Edge
 * runtime (middleware). The Credentials provider (which needs Prisma + bcrypt)
 * is added only in `auth.ts`, which runs on the Node.js runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  // Providers are added in auth.ts (Node runtime). Keep empty here for edge.
  providers: [],
  callbacks: {
    // Route protection for middleware. Protected areas: /dashboard and /polls/**
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isProtected =
        pathname.startsWith("/dashboard") || pathname.startsWith("/polls");

      if (isProtected) return isLoggedIn;

      // Redirect logged-in users away from auth pages.
      if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.email = user.email as string;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
