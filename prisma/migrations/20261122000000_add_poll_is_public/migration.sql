-- Public-link answer mode: when true (and the poll is published), any
-- signed-in user may answer via the poll link without an invite or grant.
ALTER TABLE "Poll" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
