ALTER TABLE "OutlookConnection"
 ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "importSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "syncLease" TEXT,
 ADD COLUMN "leaseUntil" TIMESTAMP(3),
 ADD COLUMN "nextSyncAt" TIMESTAMP(3),
 ADD COLUMN "lastErrorCode" TEXT;
ALTER TABLE "OutlookConnection" ADD CONSTRAINT "outlook_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "EmailSignal" ADD COLUMN "encryptedPayload" TEXT;
