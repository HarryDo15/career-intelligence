CREATE TABLE "GmailConnection" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "googleAccountId" TEXT NOT NULL UNIQUE,
 "emailAddress" TEXT NOT NULL,
 "encryptedTokens" TEXT NOT NULL,
 "encryptedSyncState" TEXT,
 "scopes" TEXT[] NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
 "importSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSyncedAt" TIMESTAMP(3),
 "reauthRequired" BOOLEAN NOT NULL DEFAULT false,
 "lastErrorCode" TEXT,
 "nextSyncAt" TIMESTAMP(3),
 "syncLease" TEXT,
 "leaseUntil" TIMESTAMP(3)
);
ALTER TABLE "EmailSignal" ALTER COLUMN "connectionId" DROP NOT NULL;
ALTER TABLE "EmailSignal" ADD COLUMN "gmailConnectionId" TEXT REFERENCES "GmailConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailSignal" ADD CONSTRAINT "email_signal_one_provider" CHECK (num_nonnulls("connectionId", "gmailConnectionId") = 1);
CREATE UNIQUE INDEX "EmailSignal_gmailConnectionId_messageId_key" ON "EmailSignal"("gmailConnectionId", "messageId");
CREATE INDEX "EmailSignal_gmailConnectionId_reviewStatus_idx" ON "EmailSignal"("gmailConnectionId", "reviewStatus");
