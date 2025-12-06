import crypto from "node:crypto";
import prisma from "../db";

const SESSION_COOKIE_NAME = "cs_session_id";

export const getSessionCookieName = () => SESSION_COOKIE_NAME;

export const generateSessionId = (): string => crypto.randomUUID();

export const parseSessionIdFromCookieHeader = (cookieHeader?: string | null): string | null => {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${SESSION_COOKIE_NAME}=`)) continue;
    const [, value] = part.split("=", 2);
    if (!value) return null;
    const trimmed = decodeURIComponent(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

export const ensureSessionId = (cookieHeader?: string | null): { sessionId: string; isNew: boolean } => {
  const existing = parseSessionIdFromCookieHeader(cookieHeader);
  if (existing) {
    return { sessionId: existing, isNew: false };
  }
  return { sessionId: generateSessionId(), isNew: true };
};

export const buildSessionCookie = (sessionId: string, options?: { maxAgeSeconds?: number }) => {
  const parts = [`${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`, "Path=/"];
  const maxAge = options?.maxAgeSeconds ?? 60 * 60 * 24 * 30; // 30 days
  if (maxAge > 0) {
    parts.push(`Max-Age=${maxAge}`);
  }
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  parts.push("HttpOnly", "SameSite=Lax");
  return parts.join("; ");
};

export const getAnalysesForSession = async (sessionId: string) => {
  if (!sessionId.trim()) return [];
  return prisma.videoAnalysis.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    include: {
      creator: true,
      videoFingerprint: true,
    },
  });
};

