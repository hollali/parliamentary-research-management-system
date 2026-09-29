-- Allow the requesting MP to sign off on a delivered brief.
-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'MEMBER_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'MEMBER_CONFIRMED';
ALTER TYPE "ActivityAction" ADD VALUE 'MEMBER_CONFIRMED';

-- AlterTable
ALTER TABLE "research_requests"
ADD COLUMN "memberConfirmedAt" TIMESTAMP(3),
ADD COLUMN "memberConfirmationNote" TEXT,
ADD COLUMN "memberConfirmedById" TEXT;

-- AddForeignKey
ALTER TABLE "research_requests"
ADD CONSTRAINT "research_requests_memberConfirmedById_fkey"
FOREIGN KEY ("memberConfirmedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
