-- FixSchemaDrift: Add missing columns, indexes, and constraints from schema that were never migrated

-- 1. Add notificationPrefs to users (JSON column with default)
ALTER TABLE "users" ADD COLUMN "notificationPrefs" JSONB DEFAULT '{"pushNotifications":true,"emailSummaries":true,"triggers":{"newAssignments":true,"statusChanges":true,"draftMentions":true,"deadlineReminders":true}}';

-- 2. Add threading + annotation fields to review_comments
ALTER TABLE "review_comments" ADD COLUMN "parentId" TEXT;
ALTER TABLE "review_comments" ADD COLUMN "highlightedText" TEXT;
ALTER TABLE "review_comments" ADD COLUMN "startOffset" INTEGER;
ALTER TABLE "review_comments" ADD COLUMN "endOffset" INTEGER;

-- 3. Add FK for review_comments.parentId (self-referential)
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "review_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Add FK for research_reports.approvedById (column existed but had no constraint)
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Drop SUPER_ADMIN from Role enum
-- Handled by prisma db push (recreates enum and migrates data)

-- 6. Performance indexes
CREATE INDEX "research_requests_submitterId_idx" ON "research_requests"("submitterId");
CREATE INDEX "research_requests_assignedOfficerId_idx" ON "research_requests"("assignedOfficerId");
CREATE INDEX "research_requests_status_idx" ON "research_requests"("status");
CREATE INDEX "research_requests_priority_idx" ON "research_requests"("priority");
CREATE INDEX "research_requests_deadline_idx" ON "research_requests"("deadline");
CREATE INDEX "research_requests_categoryId_idx" ON "research_requests"("categoryId");
CREATE INDEX "research_requests_teamId_idx" ON "research_requests"("teamId");
CREATE INDEX "assignments_requestId_idx" ON "assignments"("requestId");
CREATE INDEX "assignments_assignedToId_idx" ON "assignments"("assignedToId");
CREATE INDEX "research_reports_requestId_idx" ON "research_reports"("requestId");
CREATE INDEX "research_reports_authorId_idx" ON "research_reports"("authorId");
CREATE INDEX "review_comments_reportId_idx" ON "review_comments"("reportId");
CREATE INDEX "review_comments_requestId_idx" ON "review_comments"("requestId");
CREATE INDEX "review_comments_parentId_idx" ON "review_comments"("parentId");
CREATE INDEX "notifications_recipientId_idx" ON "notifications"("recipientId");
CREATE INDEX "notifications_recipientId_isRead_idx" ON "notifications"("recipientId", "isRead");
CREATE INDEX "activity_logs_authorId_idx" ON "activity_logs"("authorId");
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
CREATE INDEX "attachments_requestId_idx" ON "attachments"("requestId");
