import { NextResponse } from "next/server";
import prisma from "../../../../../lib/db";
import { ConfigError, getAppConfig } from "../../../../../lib/config";

export async function GET() {
  try {
    const config = getAppConfig();
    if (!config.performanceEnabled) {
      return NextResponse.json({ performanceEnabled: false, connected: false });
    }

    const tokenCount = await prisma.youtubeAuthToken.count();

    return NextResponse.json({
      performanceEnabled: true,
      connected: tokenCount > 0,
      tokens: tokenCount,
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json(
        { performanceEnabled: false, connected: false, error: error.message },
        { status: 200 },
      );
    }

    console.error("Failed to read YouTube auth status", error);
    return NextResponse.json(
      { performanceEnabled: false, connected: false, error: "Could not determine YouTube status." },
      { status: 500 },
    );
  }
}
