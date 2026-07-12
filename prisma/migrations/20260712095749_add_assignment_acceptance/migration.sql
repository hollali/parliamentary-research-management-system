/*
  Warnings:

  - You are about to drop the column `dateAssigned` on the `assignments` table. All the data in the column will be lost.
  - You are about to drop the column `isAccepted` on the `assignments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "assignments" DROP COLUMN "dateAssigned",
DROP COLUMN "isAccepted",
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "declineReason" TEXT,
ADD COLUMN     "declinedAt" TIMESTAMP(3);
