-- AlterTable: Add updatedAt to models that were missing it
ALTER TABLE "notifications" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "attachments" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "report_versions" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "shared_research" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "team_members" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Rename categoryId to committeeId on research_requests
ALTER TABLE "research_requests" RENAME COLUMN "categoryId" TO "committeeId";
ALTER INDEX "research_requests_categoryId_idx" RENAME TO "research_requests_committeeId_idx";
