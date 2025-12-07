import { NextResponse } from "next/server";
import { exchangeCodeForTokens, persistYoutubeTokens } from "../../../../../lib/auth/google";
import { ConfigError } from "../../../../../lib/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("youtube", "denied");
    redirectUrl.searchParams.set("reason", errorParam);
    return NextResponse.redirect(redirectUrl);
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
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("youtube", "connected");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    console.error("OAuth callback error:", error);
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("youtube", "error");
    return NextResponse.redirect(redirectUrl);
  }
}
