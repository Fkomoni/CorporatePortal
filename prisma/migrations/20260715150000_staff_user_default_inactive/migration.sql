-- Only ever explicitly enabled from now on; existing rows keep their value.
ALTER TABLE "staff_users" ALTER COLUMN "active" SET DEFAULT false;
