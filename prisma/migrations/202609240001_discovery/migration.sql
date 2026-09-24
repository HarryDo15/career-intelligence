ALTER TABLE "SearchProfile" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SearchProfile" ADD CONSTRAINT "SearchProfile_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "WorkflowRun" ADD COLUMN "profileId" TEXT, ADD COLUMN "resultCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SearchProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_resultCount_nonnegative" CHECK ("resultCount" >= 0);
CREATE INDEX "WorkflowRun_profileId_startedAt_idx" ON "WorkflowRun"("profileId", "startedAt");
