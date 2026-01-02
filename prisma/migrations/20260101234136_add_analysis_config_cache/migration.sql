-- AlterTable
ALTER TABLE "VideoAnalysis" ADD COLUMN "analysisConfigHash" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "analysisConfigJson" TEXT;
ALTER TABLE "VideoAnalysis" ADD COLUMN "analysisVersion" TEXT;

-- CreateIndex
CREATE INDEX "VideoAnalysis_youtubeVideoId_analysisConfigHash_status_idx" ON "VideoAnalysis"("youtubeVideoId", "analysisConfigHash", "status");
