-- Allow request-level comments (e.g. MP directives/feedback) that are not
-- attached to a research report, so feedback on a request without a draft
-- can be persisted instead of being silently dropped.
ALTER TABLE "review_comments" ALTER COLUMN "reportId" DROP NOT NULL;
