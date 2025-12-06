import type { AppConfig } from "../config";

export type AuthContext = {
  userId: string;
  googleAccountId?: string | null;
  email?: string | null;
};

/**
 * Placeholder resolver for current user auth context.
 * Iteration 4 will wire this to session/cookie-derived identity and fetched OAuth tokens.
 */
export const getAuthContext = async (): Promise<AuthContext | null> => {
  return null;
};

export const requirePerformanceReady = (config: AppConfig) => {
  if (!config.performanceEnabled) return;
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUrl) {
    throw new Error("Performance mode requires Google OAuth credentials to be configured.");
  }
};
