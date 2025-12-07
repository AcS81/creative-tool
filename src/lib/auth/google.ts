import { ConfigError, getAppConfig } from "../config";
import prisma from "../db";
import { encryptString } from "./crypto";

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export const buildOAuthUrl = (state?: string) => {
  const config = getAppConfig();
  if (!config.googleClientId || !config.googleRedirectUrl) {
    throw new ConfigError("Missing Google OAuth configuration.");
  }
  const url = new URL(GOOGLE_OAUTH_URL);
  url.searchParams.set("client_id", config.googleClientId);
  url.searchParams.set("redirect_uri", config.googleRedirectUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", SCOPES.join(" "));
  if (state) url.searchParams.set("state", state);
  return url.toString();
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export const exchangeCodeForTokens = async (code: string): Promise<TokenResponse> => {
  const config = getAppConfig();
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUrl) {
    throw new ConfigError("Missing Google OAuth configuration.");
  }

  const body = new URLSearchParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: config.googleRedirectUrl,
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text || res.statusText}`);
  }

  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) {
    throw new Error("Google token exchange did not return an access token.");
  }
  return json;
};

const ensureLocalUser = async () => {
  const existing = await prisma.user.findFirst();
  if (existing) return existing;
  return prisma.user.create({
    data: {
      displayName: "Local User",
    },
  });
};

export const persistYoutubeTokens = async (tokens: TokenResponse) => {
  const config = getAppConfig();
  if (!config.tokenEncryptionKey) {
    throw new ConfigError("TOKEN_ENCRYPTION_KEY is required to store OAuth tokens.");
  }

  const user = await ensureLocalUser();

  const accessTokenEncrypted = encryptString(tokens.access_token, config.tokenEncryptionKey);
  const refreshTokenEncrypted = tokens.refresh_token
    ? encryptString(tokens.refresh_token, config.tokenEncryptionKey)
    : null;
  const normalizedRefreshToken = refreshTokenEncrypted ?? "";

  await prisma.youtubeAuthToken.upsert({
    where: { userId: user.id },
    update: {
      accessTokenEncrypted,
      refreshTokenEncrypted: normalizedRefreshToken,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    },
    create: {
      userId: user.id,
      accessTokenEncrypted,
      refreshTokenEncrypted: normalizedRefreshToken,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    },
  });

  return { userId: user.id };
};
