-- CreateTable
CREATE TABLE "shared_research" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sharedWithId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_research_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_research_requestId_sharedWithId_key" ON "shared_research"("requestId", "sharedWithId");

-- AddForeignKey
ALTER TABLE "shared_research" ADD CONSTRAINT "shared_research_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "research_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_research" ADD CONSTRAINT "shared_research_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_research" ADD CONSTRAINT "shared_research_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
