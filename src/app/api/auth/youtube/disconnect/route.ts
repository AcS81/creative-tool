import { NextResponse } from "next/server";
import prisma from "../../../../../lib/db";
import { getAppConfig } from "../../../../../lib/config";

export async function POST() {
  const config = getAppConfig();
  if (!config.performanceEnabled) {
    return NextResponse.json(
      { error: "PerformanceDisabled", message: "Performance mode is not enabled." },
      { status: 400 },
    );
  }

  try {
    const deleted = await prisma.youtubeAuthToken.deleteMany();
    return NextResponse.json({ status: "ok", revoked: deleted.count });
  } catch (error) {
    console.error("Failed to disconnect YouTube tokens", error);
    return NextResponse.json(
      { error: "DisconnectFailed", message: "Could not revoke YouTube tokens." },
      { status: 500 },
    );
  }
}
