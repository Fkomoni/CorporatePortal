-- CreateTable
CREATE TABLE "member_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'self',
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_invitations_token_key" ON "member_invitations"("token");

-- CreateIndex
CREATE INDEX "member_invitations_email_employeeCode_idx" ON "member_invitations"("email", "employeeCode");
