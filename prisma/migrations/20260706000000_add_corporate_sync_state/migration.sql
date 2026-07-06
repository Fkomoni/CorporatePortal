-- CreateTable
CREATE TABLE "corporate_sync_state" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyName" TEXT,
    "policyNumber" TEXT,
    "adminEmail" TEXT,
    "welcomeSentAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "corporate_sync_state_groupId_key" ON "corporate_sync_state"("groupId");
