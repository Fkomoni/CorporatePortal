-- Lets Leadway staff answer a request from the emailed link, without a portal
-- login, and feeds the replies back onto the ticket HR sees.
ALTER TABLE "service_requests" ADD COLUMN "responseToken" TEXT;
ALTER TABLE "service_requests" ADD COLUMN "responseTokenExpires" TIMESTAMP(3);

-- Unique so a token identifies exactly one request, and indexed because the
-- respond page looks a request up by it on every load.
CREATE UNIQUE INDEX "service_requests_responseToken_key" ON "service_requests"("responseToken");

-- A thread, not a single column: Leadway may answer, wait for the client, and
-- answer again before resolving, and one column would let the second reply
-- erase the first.
CREATE TABLE "service_request_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Responded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_request_responses_requestId_createdAt_idx"
    ON "service_request_responses"("requestId", "createdAt");

-- Deleting a request takes its thread with it; a reply has no meaning alone.
ALTER TABLE "service_request_responses"
    ADD CONSTRAINT "service_request_responses_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "service_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
