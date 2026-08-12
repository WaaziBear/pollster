# Pollster

A full-stack polling web app: create polls with a variety of question types,
invite people privately by email, collect responses, and view aggregated
results. Built with Next.js (App Router) + TypeScript, PostgreSQL, Prisma, and
Auth.js (NextAuth v5) email/password authentication.

## Features

- **Email/password auth** with hashed passwords (bcrypt) and JWT sessions
  (Auth.js v5 Credentials provider). Signup, login, logout.
- **Dashboard** with two sections: **My Polls** (created by you) and
  **Shared With Me** (polls you were invited to).
- **Poll builder** supporting multiple questions of varied types — single-choice
  (radio), multiple-choice (checkbox), free text, and rating/scale — with a
  schema designed to add new types without destructive migrations.
- **Invite by email**: only invited emails can view/answer a poll. Invites sent
  before signup surface automatically once the invitee registers. All
  authorization is enforced **server-side** (in the database query).
- **Answer submission** (edit-in-place) and a **results/aggregate view** for the
  creator: per-option counts, rating averages/distribution, and free-text lists.

## Tech stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| Framework      | Next.js 15 (App Router), React 19, TypeScript      |
| Database       | PostgreSQL                                         |
| ORM            | Prisma 6                                           |
| Auth           | Auth.js (NextAuth v5) Credentials + JWT sessions   |
| Passwords      | bcryptjs (work factor 12), isolated in `lib/hash`  |
| Validation     | Zod (shared client + server)                       |
| UI             | Tailwind CSS + shadcn/ui-style primitives, Lucide  |
| Tests          | Vitest + Testing Library                           |

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL) — or any PostgreSQL 14+ instance

## Getting started

This is the confirmed local flow (verified on Windows). Run the steps as
separate commands — see the [Windows notes](#windows-notes) below.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
#    macOS/Linux:  cp .env.example .env
#    Windows:      copy .env.example .env
#   - set AUTH_SECRET (e.g. `npx auth secret` or `openssl rand -base64 32`)
#   - DATABASE_URL already matches the docker-compose service

# 3. Start PostgreSQL
docker compose up -d

# 4. Apply migrations (creates the schema)
npx prisma migrate deploy
#   (equivalently: npm run prisma:deploy)

# 5. Seed sample data
npm run db:seed

# 6. Run the app
npm run dev
# open http://localhost:3000
```

Then sign in with a seeded account:

| Email               | Password      |
| ------------------- | ------------- |
| `alice@example.com` | `Password123` |
| `bob@example.com`   | `Password123` |

### Windows notes

- **`docker` not found on PATH.** If `docker compose up -d` fails with a
  "command not found" error, either launch **Docker Desktop** (which registers
  the CLI) or add its CLI directory to `PATH`:
  `C:\Program Files\Docker\Docker\resources\bin`.
- **PowerShell rejects `&&`.** PowerShell does not treat `&&` as a command
  separator, so chained commands like `cd app && npm run dev` fail. Run each
  command on its own line, or wrap the chain with `cmd /c "… && …"`.

## Environment variables

See [`.env.example`](./.env.example). Never commit a real `.env`.

| Variable          | Required | Purpose                                             |
| ----------------- | -------- | --------------------------------------------------- |
| `DATABASE_URL`    | yes      | PostgreSQL connection string (POOLED in production) |
| `DIRECT_URL`      | yes      | Direct (non-pooled) connection for migrations       |
| `AUTH_SECRET`     | yes      | Secret used to sign/encrypt session JWTs            |
| `AUTH_URL`        | no       | App base URL for Auth.js callbacks (prod)           |
| `RESEND_API_KEY`  | no       | Resend API key — enables real invite email delivery |
| `EMAIL_FROM`      | no       | Verified sender address for invite emails (Resend)  |

## Email invitations

Invite delivery is **env-gated**. When both `RESEND_API_KEY` and `EMAIL_FROM`
are set, invite emails are sent for real via [Resend](https://resend.com):
`sendInviteEmail()` in `src/lib/invites.ts` composes a minimal message linking
to the `/polls/invite/<token>` landing route. If either variable is unset (the
default in local dev), delivery **gracefully falls back to a stub** that logs
the invite link to the server console — so local development needs no email
provider. Either way the invite **records and authorization logic are real**;
only the delivery channel differs. Send failures are logged and never block the
invite from being created.

## Scripts

| Script                 | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start the dev server                           |
| `npm run build`        | `prisma generate` + `next build`               |
| `npm run vercel-build` | `prisma generate` + `migrate deploy` + `build` (used by Vercel) |
| `npm run start`        | Start the production server                    |
| `npm run lint`         | ESLint (next lint)                             |
| `npm run typecheck`    | `tsc --noEmit`                                 |
| `npm test`             | Run Vitest unit tests                          |
| `npm run prisma:migrate` | `prisma migrate dev`                         |
| `npm run prisma:deploy`  | `prisma migrate deploy` (CI/prod)            |
| `npm run db:seed`      | Seed sample data                               |

## Security model

- **All authorization is server-side.** The access predicate — *creator, OR
  (published AND a non-revoked invite matching by `userId` or normalized
  `email`)* — lives inside the Prisma `where` clause (`canAccessPoll`,
  `getPollForRespondent`), so an unauthorized user cannot even fetch another
  poll's questions.
- Owner-only actions (edit, publish, delete, invite, revoke, results) call
  `requirePollOwner`. Pages guard **before** loading data; the results page
  guards ownership itself because `getResults` performs no auth check.
- Every submitted answer is **re-validated server-side** against the question's
  real type/config; the client is never trusted.
- Passwords are hashed with bcrypt; `authorize()` returns a generic `null` on
  any failure to avoid user enumeration.
- Middleware protects `/dashboard` and `/polls/**`. The only intentionally
  public data-mutating action is signup (rate-limited).

## Project layout

```
src/
  app/                     # App Router pages + route groups (auth)/(app)
    api/auth/[...nextauth] # Auth.js route handler
  actions/                 # "use server" mutations
  lib/                     # db, hash, guards, queries, validation, invites
  components/{ui,auth,poll} # shadcn/ui-style primitives + feature components
prisma/                    # schema, migrations, seed
tests/                     # Vitest unit tests
```

## Deployment

### Vercel (provider-agnostic Postgres)

The app deploys to Vercel with any pooled-connection Postgres provider —
**Neon**, **Supabase**, or **Vercel Postgres** all work. There is no hard
dependency on a specific provider or on Prisma Accelerate.

1. **Import the repo** into Vercel (New Project → import from GitHub). Next.js
   is auto-detected; no `vercel.json` is required.
2. **Set environment variables** in the Vercel dashboard (Project → Settings →
   Environment Variables):

   | Variable         | Value                                                            |
   | ---------------- | ---------------------------------------------------------------- |
   | `DATABASE_URL`   | **Pooled** connection string (Neon pooler / Supabase pgbouncer / Vercel Postgres). Used at runtime by serverless functions. |
   | `DIRECT_URL`     | **Direct** (non-pooled) connection string. Used only for migrations. |
   | `AUTH_SECRET`    | A **freshly generated** secret (`npx auth secret` or `openssl rand -base64 32`). **Do NOT reuse the local dev placeholder.** |
   | `AUTH_URL`       | Optional. `trustHost: true` is enabled so Auth.js resolves the host from Vercel's forwarded headers; set this to your Vercel URL only if you need to pin it. |
   | `RESEND_API_KEY` | Optional — enables real invite email delivery.                   |
   | `EMAIL_FROM`     | Optional — verified Resend sender address.                       |

3. **Migrations run automatically on deploy.** Vercel prefers the `vercel-build`
   script when present, which runs
   `prisma generate && prisma migrate deploy && next build`. `prisma migrate
   deploy` applies pending migrations against `DIRECT_URL`. (The local `build`
   script is unchanged and does **not** run migrations.)
4. Push to the connected branch — Vercel builds, migrates, and deploys.

> **Security:** Never reuse local `.env` values in production. Generate a new
> `AUTH_SECRET` for the deployed environment and keep all connection strings in
> the Vercel dashboard, not in the repo.

### Generic host (non-Vercel)

1. Provision a PostgreSQL database and set `DATABASE_URL`, `DIRECT_URL`, and
   `AUTH_SECRET` (and `AUTH_URL` if needed) in the host environment.
2. Run `npm ci && npm run prisma:deploy` to apply migrations.
3. `npm run build && npm run start`.

The included GitHub Actions workflow (`.github/workflows/ci.yml`) runs install,
typecheck, lint, tests, and a production build against a Postgres service on
every push/PR.
