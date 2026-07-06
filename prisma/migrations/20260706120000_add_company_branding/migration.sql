-- CreateTable
CREATE TABLE "company_branding" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "logoDataUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_branding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_branding_groupId_key" ON "company_branding"("groupId");
