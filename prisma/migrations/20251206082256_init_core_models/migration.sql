/*
  Warnings:

  - Added the required column `displayName` to the `CreatorProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `CreatorProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CreatorProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creatorId` to the `VideoAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `durationSeconds` to the `VideoAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `VideoAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `VideoAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `VideoAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `youtubeVideoId` to the `VideoAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fingerprint` to the `VideoFingerprint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `videoAnalysisId` to the `VideoFingerprint` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CreatorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "channelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CreatorProfile" ("id") SELECT "id" FROM "CreatorProfile";
DROP TABLE "CreatorProfile";
ALTER TABLE "new_CreatorProfile" RENAME TO "CreatorProfile";
CREATE UNIQUE INDEX "CreatorProfile_channelId_key" ON "CreatorProfile"("channelId");
CREATE TABLE "new_VideoAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoAnalysis_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoAnalysis" ("id") SELECT "id" FROM "VideoAnalysis";
DROP TABLE "VideoAnalysis";
ALTER TABLE "new_VideoAnalysis" RENAME TO "VideoAnalysis";
CREATE INDEX "VideoAnalysis_creatorId_idx" ON "VideoAnalysis"("creatorId");
CREATE INDEX "VideoAnalysis_youtubeVideoId_idx" ON "VideoAnalysis"("youtubeVideoId");
CREATE TABLE "new_VideoFingerprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoAnalysisId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoFingerprint_videoAnalysisId_fkey" FOREIGN KEY ("videoAnalysisId") REFERENCES "VideoAnalysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoFingerprint" ("id") SELECT "id" FROM "VideoFingerprint";
DROP TABLE "VideoFingerprint";
ALTER TABLE "new_VideoFingerprint" RENAME TO "VideoFingerprint";
CREATE UNIQUE INDEX "VideoFingerprint_videoAnalysisId_key" ON "VideoFingerprint"("videoAnalysisId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
