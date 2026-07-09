-- CreateTable
CREATE TABLE "scheduled_terminations" (
    "id" TEXT NOT NULL,
    "cifNumber" TEXT NOT NULL,
    "memberName" TEXT,
    "groupId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "scheduled_terminations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_terminations_status_effectiveDate_idx" ON "scheduled_terminations"("status", "effectiveDate");
