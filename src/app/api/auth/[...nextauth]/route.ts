import { handlers } from "@/auth";

// Auth.js v5 callback/session/csrf endpoint. Runs on the Node.js runtime so the
// Credentials provider (Prisma + bcrypt in @/auth) works. Without this route,
// signIn/signOut/session have no backend endpoint.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
