import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { disconnectPrisma } from "./config/prisma";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`, {
    env: env.NODE_ENV,
    pid: process.pid,
  });
});

function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await disconnectPrisma();
    logger.info("Server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { message: err.message, stack: err.stack });
  process.exit(1);
});
