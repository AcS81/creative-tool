import { NextResponse } from "next/server";
import { exchangeCodeForTokens, persistYoutubeTokens } from "../../../../../lib/auth/google";
import { ConfigError } from "../../../../../lib/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.json(
      { error: "OAuthDenied", message: `YouTube connection was not authorized: ${errorParam}` },
      { status: 400 },
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "InvalidRequest", message: "Missing OAuth authorization code." },
      { status: 400 },
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await persistYoutubeTokens(tokens);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: "OAuthCallbackFailed", message: "Failed to complete YouTube OAuth." },
      { status: 500 },
    );
  }
}
