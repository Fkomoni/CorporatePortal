-- Track members enrolled via HR-issued self-service links, so Pending
-- Enrolees can distinguish "Corporate Portal" (link) registrations from
-- "Enrolee App" (mobile) ones.
CREATE TABLE "link_registrations" (
    "id" TEXT NOT NULL,
    "cifNumber" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "link_registrations_cifNumber_key" ON "link_registrations"("cifNumber");
