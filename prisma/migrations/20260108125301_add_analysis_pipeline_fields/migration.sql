-- AlterTable
ALTER TABLE "VideoAnalysis" ADD COLUMN "advancedMetricsJson" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "analysisStage" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "coreMetricsJson" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "fingerprintSchemaHash" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "fingerprintSchemaVersion" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "ingestionJson" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "leaseExpiresAt" DATETIME;
ALTER TABLE "VideoAnalysis" ADD COLUMN "leaseHeartbeatAt" DATETIME;
ALTER TABLE "VideoAnalysis" ADD COLUMN "leaseOwner" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "stageCompletedAt" DATETIME;
ALTER TABLE "VideoAnalysis" ADD COLUMN "stageStartedAt" DATETIME;

-- CreateIndex
CREATE INDEX "VideoAnalysis_leaseExpiresAt_idx" ON "VideoAnalysis"("leaseExpiresAt");
