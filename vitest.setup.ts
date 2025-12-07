// @ts-nocheck
import prisma from "./src/lib/db";

beforeAll(async () => {
  // Soften FK constraints in local sqlite during tests and start from a clean slate.
  try {
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
  } catch {
    // Ignore pragma failures in non-sqlite environments.
  }

  await prisma.youtubeAuthToken.deleteMany();
  await prisma.videoFingerprint.deleteMany();
  await prisma.videoAnalysis.deleteMany();
  await prisma.creatorProfile.deleteMany();
  await prisma.user.deleteMany();
});

beforeEach(async () => {
  await prisma.youtubeAuthToken.deleteMany();
  await prisma.videoFingerprint.deleteMany();
  await prisma.videoAnalysis.deleteMany();
  await prisma.creatorProfile.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
