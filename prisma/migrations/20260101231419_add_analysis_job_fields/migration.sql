-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VideoAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channelTitle" TEXT,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "sessionId" TEXT,
    "passMode" TEXT,
    "idempotencyKey" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "diagnosticsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoAnalysis_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoAnalysis" ("channelTitle", "createdAt", "creatorId", "durationSeconds", "failureReason", "id", "sessionId", "status", "thumbnailUrl", "title", "updatedAt", "youtubeVideoId") SELECT "channelTitle", "createdAt", "creatorId", "durationSeconds", "failureReason", "id", "sessionId", "status", "thumbnailUrl", "title", "updatedAt", "youtubeVideoId" FROM "VideoAnalysis";
DROP TABLE "VideoAnalysis";
ALTER TABLE "new_VideoAnalysis" RENAME TO "VideoAnalysis";
CREATE UNIQUE INDEX "VideoAnalysis_idempotencyKey_key" ON "VideoAnalysis"("idempotencyKey");
CREATE INDEX "VideoAnalysis_creatorId_idx" ON "VideoAnalysis"("creatorId");
CREATE INDEX "VideoAnalysis_youtubeVideoId_idx" ON "VideoAnalysis"("youtubeVideoId");
CREATE INDEX "VideoAnalysis_sessionId_idx" ON "VideoAnalysis"("sessionId");
CREATE INDEX "VideoAnalysis_status_idx" ON "VideoAnalysis"("status");
CREATE INDEX "VideoAnalysis_nextAttemptAt_idx" ON "VideoAnalysis"("nextAttemptAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
