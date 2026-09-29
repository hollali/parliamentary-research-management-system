-- Backfill schema objects that were declared in schema.prisma but never had a
-- migration. The local development database was mutated out of band with
-- `prisma db push`, so these only existed there; `prisma migrate deploy`
-- against any other environment produced:
--
--   prisma error: relation "templates" does not exist
--
-- breaking request listing (requests.ts selects `template`), the whole report
-- workflow (reports.ts selects `supersededAt` inside officerCanWorkRequest),
-- reassignment, and password reset (no password_reset_tokens table).

-- 1. password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 2. templates
CREATE TABLE IF NOT EXISTS "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "templates_createdById_idx" ON "templates"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'templates_createdById_fkey'
  ) THEN
    ALTER TABLE "templates"
      ADD CONSTRAINT "templates_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 3. research_requests.templateId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'research_requests' AND column_name = 'templateId'
  ) THEN
    ALTER TABLE "research_requests" ADD COLUMN "templateId" TEXT;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "research_requests_templateId_idx" ON "research_requests"("templateId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_requests_templateId_fkey'
  ) THEN
    ALTER TABLE "research_requests"
      ADD CONSTRAINT "research_requests_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 4. assignments.supersededAt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignments' AND column_name = 'supersededAt'
  ) THEN
    ALTER TABLE "assignments" ADD COLUMN "supersededAt" TIMESTAMP(3);
  END IF;
END$$;

-- 5. Realign the constraint name left behind by the categoryId -> committeeId
-- rename: the column was renamed but the FK constraint was not, leaving a
-- column named committeeId guarded by ..._categoryId_fkey. Prisma treats this
-- as drift and would generate a DROP CONSTRAINT, destroying the request ->
-- committee classification that all per-committee reporting depends on.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_requests_categoryId_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_requests_committeeId_fkey'
  ) THEN
    ALTER TABLE "research_requests"
      RENAME CONSTRAINT "research_requests_categoryId_fkey" TO "research_requests_committeeId_fkey";
  END IF;
END$$;

-- 6. Declare the approver relation that a previous migration created as a
-- constraint but schema.prisma modelled as a bare scalar. Without the @relation
-- Prisma does not know the column exists as an FK, so the next `db push` or
-- `migrate dev` strips research_reports_approvedById_fkey.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_reports_approvedById_fkey'
  ) THEN
    ALTER TABLE "research_reports"
      ADD CONSTRAINT "research_reports_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 7. Foreign keys that are used in `where` clauses but had no leading index.
-- Postgres does not auto-index FK columns, and these three sit in the hot
-- authorization path (every request-list and report-upload call).
CREATE INDEX IF NOT EXISTS "team_members_userId_idx" ON "team_members"("userId");
CREATE INDEX IF NOT EXISTS "shared_research_sharedWithId_idx" ON "shared_research"("sharedWithId");
CREATE INDEX IF NOT EXISTS "research_requests_memberConfirmedById_idx" ON "research_requests"("memberConfirmedById");
CREATE INDEX IF NOT EXISTS "assignments_teamId_idx" ON "assignments"("teamId");
CREATE INDEX IF NOT EXISTS "review_comments_authorId_idx" ON "review_comments"("authorId");
CREATE INDEX IF NOT EXISTS "shared_research_sharedById_idx" ON "shared_research"("sharedById");
CREATE INDEX IF NOT EXISTS "attachments_uploadedById_idx" ON "attachments"("uploadedById");
CREATE INDEX IF NOT EXISTS "research_reports_uploadedById_idx" ON "research_reports"("uploadedById");
CREATE INDEX IF NOT EXISTS "assignments_assignedById_idx" ON "assignments"("assignedById");
CREATE INDEX IF NOT EXISTS "research_teams_leadId_idx" ON "research_teams"("leadId");
CREATE INDEX IF NOT EXISTS "users_departmentId_idx" ON "users"("departmentId");

-- 8. Enforce one ACTIVE assignment per (request, officer). "Active" is defined
-- by two nullable timestamps, so it needs a partial index rather than a
-- composite unique constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "assignments_active_officer_key"
  ON "assignments" ("requestId", "assignedToId")
  WHERE "supersededAt" IS NULL AND "declinedAt" IS NULL AND "assignedToId" IS NOT NULL;

-- 9. One report version number per request. @@unique([reportId, version]) on
-- ReportVersion protects nothing because a NEW report row is created per
-- upload, so every version is (newId, 1). Concurrent submissions could
-- therefore both read version N and both write N+1, leaving two reports with
-- the same number and an audit trail that cannot say which draft was approved.
CREATE UNIQUE INDEX IF NOT EXISTS "research_reports_requestId_version_key"
  ON "research_reports" ("requestId", "version");

-- 10. A comment may not be its own parent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_comments_no_self_parent'
  ) THEN
    ALTER TABLE "review_comments"
      ADD CONSTRAINT "review_comments_no_self_parent"
      CHECK ("parentId" IS NULL OR "parentId" <> "id");
  END IF;
END$$;

-- 11. An assignment must point at an officer or a team, not neither.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_requires_target'
  ) THEN
    ALTER TABLE "assignments"
      ADD CONSTRAINT "assignments_requires_target"
      CHECK ("assignedToId" IS NOT NULL OR "teamId" IS NOT NULL);
  END IF;
END$$;
