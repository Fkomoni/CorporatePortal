-- Add mobile number and preferred 2FA delivery method
ALTER TABLE "users" ADD COLUMN "mobile" TEXT;
ALTER TABLE "users" ADD COLUMN "twoFaMethod" TEXT NOT NULL DEFAULT 'email';
