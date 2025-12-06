-- AlterTable
ALTER TABLE "VideoAnalysis" ADD COLUMN "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "VideoAnalysis_sessionId_idx" ON "VideoAnalysis"("sessionId");
