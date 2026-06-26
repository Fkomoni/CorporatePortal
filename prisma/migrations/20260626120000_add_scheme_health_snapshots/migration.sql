-- CreateTable
CREATE TABLE "scheme_health_snapshots" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "lossRatio" DOUBLE PRECISION,
    "cor" DOUBLE PRECISION,
    "utilRate" DOUBLE PRECISION,
    "riskStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheme_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheme_health_snapshots_groupId_yearMonth_key" ON "scheme_health_snapshots"("groupId", "yearMonth");
