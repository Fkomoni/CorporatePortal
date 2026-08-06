-- HR service requests (Service Desk) — replaces the page's mock tickets.
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "groupId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdByEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_requests_seq_key" ON "service_requests"("seq");

CREATE INDEX "service_requests_groupId_createdAt_idx" ON "service_requests"("groupId", "createdAt");

-- Per-corporate dashboard announcement, managed by Leadway staff.
ALTER TABLE "company_branding" ADD COLUMN "systemNotice" TEXT;
