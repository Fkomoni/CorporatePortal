-- Filenames attached to a Service Desk request. The files themselves are sent
-- on the email to the queue that owns the request, not stored here: but the
-- portal record needs to show what was attached.
ALTER TABLE "service_requests" ADD COLUMN "attachmentNames" TEXT[] NOT NULL DEFAULT '{}';
