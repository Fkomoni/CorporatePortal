-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'officer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "loginOtpHash" TEXT,
    "loginOtpExpiresAt" TIMESTAMP(3),
    "loginOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_client_access" (
    "id" TEXT NOT NULL,
    "staffEmail" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyName" TEXT,
    "policyNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_client_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_client_access_staffEmail_companyId_key" ON "staff_client_access"("staffEmail", "companyId");

-- AddForeignKey
ALTER TABLE "staff_client_access" ADD CONSTRAINT "staff_client_access_staffEmail_fkey" FOREIGN KEY ("staffEmail") REFERENCES "staff_users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
