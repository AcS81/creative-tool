import type { AppConfig } from "../config";
import { getAppConfig } from "../config";
import prisma from "../db";

export type AuthContext = {
  userId: string;
  googleAccountId?: string | null;
  email?: string | null;
};

export const getAuthContext = async (): Promise<AuthContext | null> => {
  const config = getAppConfig();
  if (!config.performanceEnabled) return null;

  const user = await prisma.user.findFirst();
  if (!user) return null;

  return {
    userId: user.id,
    googleAccountId: user.googleAccountId,
    email: user.email,
  };
};

export const requirePerformanceReady = (config: AppConfig) => {
  if (!config.performanceEnabled) return;
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUrl) {
    throw new Error("Performance mode requires Google OAuth credentials to be configured.");
  }
};
