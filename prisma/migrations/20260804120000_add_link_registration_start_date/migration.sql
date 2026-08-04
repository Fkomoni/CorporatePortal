-- Cover start date HR chose on the invitation, carried through to approval so
-- the effective date isn't silently reset to the day HR approves.
ALTER TABLE "link_registrations" ADD COLUMN "startDate" TEXT;
