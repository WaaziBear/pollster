import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Idempotent dev seed: two users and one published sample poll owned by Alice
 * with a variety of question types, plus an invite for Bob so the poll shows up
 * in Bob's "Shared With Me" list.
 *
 * Login credentials (dev only):
 *   alice@example.com / Password123
 *   bob@example.com   / Password123
 */
async function main() {
  const passwordHash = await bcrypt.hash("Password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { email: "alice@example.com", name: "Alice", passwordHash },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { email: "bob@example.com", name: "Bob", passwordHash },
  });

  // Only create the sample poll once (keyed by a stable title for this creator).
  const existing = await prisma.poll.findFirst({
    where: { creatorId: alice.id, title: "Team offsite planning" },
  });
  if (existing) {
    console.info("Seed: sample poll already exists, skipping.");
    return;
  }

  const poll = await prisma.poll.create({
    data: {
      title: "Team offsite planning",
      description: "Help us plan the next team offsite.",
      isPublished: true,
      creatorId: alice.id,
      questions: {
        create: [
          {
            type: "SINGLE_CHOICE",
            prompt: "Which city do you prefer?",
            required: true,
            order: 0,
            options: {
              create: [
                { label: "Lisbon", order: 0 },
                { label: "Berlin", order: 1 },
                { label: "Barcelona", order: 2 },
              ],
            },
          },
          {
            type: "MULTI_CHOICE",
            prompt: "Which activities interest you?",
            required: false,
            order: 1,
            config: { maxSelections: 2 },
            options: {
              create: [
                { label: "Hiking", order: 0 },
                { label: "Cooking class", order: 1 },
                { label: "City tour", order: 2 },
                { label: "Beach day", order: 3 },
              ],
            },
          },
          {
            type: "RATING",
            prompt: "How excited are you (1-5)?",
            required: true,
            order: 2,
            config: { min: 1, max: 5, step: 1 },
          },
          {
            type: "FREE_TEXT",
            prompt: "Any dietary requirements or notes?",
            required: false,
            order: 3,
            config: { maxLength: 500 },
          },
        ],
      },
    },
  });

  // Invite Bob (already registered) — link immediately as ACCEPTED.
  await prisma.invite.upsert({
    where: { pollId_email: { pollId: poll.id, email: bob.email } },
    update: {},
    create: {
      pollId: poll.id,
      email: bob.email,
      userId: bob.id,
      status: "ACCEPTED",
    },
  });

  // Invite an email that has no account yet — surfaces after they sign up.
  await prisma.invite.upsert({
    where: { pollId_email: { pollId: poll.id, email: "carol@example.com" } },
    update: {},
    create: { pollId: poll.id, email: "carol@example.com", status: "PENDING" },
  });

  console.info("Seed complete: users alice@example.com / bob@example.com (Password123).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
