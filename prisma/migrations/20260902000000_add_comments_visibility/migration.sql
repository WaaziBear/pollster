-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('ANONYMOUS', 'EDITORS', 'EVERYONE');

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "commentVisibility" "CommentVisibility" NOT NULL DEFAULT 'EDITORS';

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "comment" TEXT;
