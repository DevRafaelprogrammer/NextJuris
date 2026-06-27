import { env } from "../config/env";

const levels = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof levels;

const currentLevel = levels[env.LOG_LEVEL];

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] ${message}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (levels[level] > currentLevel) return;
  const formatted = formatMessage(level, message, meta);
  if (level === "error") console.error(formatted);
  else if (level === "warn") console.warn(formatted);
  else console.log(formatted);
}

export const logger = {
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
};
