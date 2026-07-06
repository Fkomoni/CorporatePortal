-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceIssued" BOOLEAN NOT NULL DEFAULT true,
    "invoiceDue" BOOLEAN NOT NULL DEFAULT true,
    "claimUpdates" BOOLEAN NOT NULL DEFAULT false,
    "enrolmentConfirm" BOOLEAN NOT NULL DEFAULT true,
    "bulkUpload" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");
