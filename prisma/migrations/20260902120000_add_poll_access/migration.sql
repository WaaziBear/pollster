-- CreateEnum
CREATE TYPE "PollRole" AS ENUM ('EDITOR', 'RESULTS_VIEWER');

-- CreateTable
CREATE TABLE "PollAccess" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "role" "PollRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollAccess_userId_idx" ON "PollAccess"("userId");

-- CreateIndex
CREATE INDEX "PollAccess_email_idx" ON "PollAccess"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PollAccess_pollId_email_key" ON "PollAccess"("pollId", "email");

-- AddForeignKey
ALTER TABLE "PollAccess" ADD CONSTRAINT "PollAccess_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollAccess" ADD CONSTRAINT "PollAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
