type LogLevel = "info" | "warn" | "error" | "alert";

const loggerForLevel = (level: LogLevel) => {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  return console.log;
};

const safeSerialize = (payload: unknown) => {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      level: "error",
      event: "log_serialization_failed",
      timestamp: new Date().toISOString(),
    });
  }
};

export const logEvent = (level: LogLevel, event: string, payload: Record<string, unknown> = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };
  const line = safeSerialize(entry);
  loggerForLevel(level)(line);
};
