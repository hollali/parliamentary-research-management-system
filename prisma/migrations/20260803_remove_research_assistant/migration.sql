-- Remove RESEARCH_ASSISTANT from the Role enum

-- Reassign any existing research assistants to the research officer role
UPDATE "users" SET "role" = 'RESEARCH_OFFICER' WHERE "role" = 'RESEARCH_ASSISTANT';

-- Recreate the Role enum without RESEARCH_ASSISTANT
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RESEARCH_OFFICER', 'MP');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
DROP TYPE "Role_old";
