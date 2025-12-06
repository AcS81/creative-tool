import { NextResponse } from "next/server";
import { buildOAuthUrl } from "../../../../../lib/auth/google";
import { ConfigError } from "../../../../../lib/config";

export async function GET() {
  try {
    const url = buildOAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "OAuthStartFailed", message: "Could not start OAuth flow." }, { status: 500 });
  }
}
