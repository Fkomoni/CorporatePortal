-- CreateTable
CREATE TABLE "staff_trusted_devices" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_trusted_devices_tokenHash_key" ON "staff_trusted_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "staff_trusted_devices_staffUserId_idx" ON "staff_trusted_devices"("staffUserId");
