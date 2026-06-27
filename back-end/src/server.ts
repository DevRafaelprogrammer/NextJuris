import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { disconnectPrisma } from "./config/prisma";
import { verifyConnection, disconnectDatabase, getDatabaseStatus } from "./config/database";
import { getSupabase } from "./config/supabase";

async function bootstrap(): Promise<void> {
  logger.info("Starting NextJuris backend...", { env: env.NODE_ENV, pid: process.pid });

  logger.info("Verifying Supabase connection...");
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("users").select("id", { count: "exact", head: true }).limit(0);
    if (error) throw new Error(error.message);
    logger.info("Supabase connected");
  } catch (err: any) {
    logger.warn(`Supabase connection check failed: ${err.message}`);
  }

  logger.info("Verifying PostgreSQL direct connection...");
  const pgConnected = await verifyConnection(3, 2000);
  if (pgConnected) {
    const status = await getDatabaseStatus();
    logger.info("PostgreSQL connected", {
      version: status.server?.version,
      database: status.server?.database,
      latency: `${status.latency}ms`,
      pool: `${status.pool.total} total, ${status.pool.idle} idle`,
    });
  } else {
    logger.warn("PostgreSQL direct connection unavailable — running with Supabase HTTP only");
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server ready on port ${env.PORT}`, {
      endpoints: {
        app: `http://localhost:${env.PORT}`,
        auth: `http://localhost:${env.PORT}/auth`,
        api: `http://localhost:${env.PORT}/api`,
        health: `http://localhost:${env.PORT}/api/health`,
        healthDb: `http://localhost:${env.PORT}/api/health/db`,
      },
    });
  });

  function gracefulShutdown(signal: string): void {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      logger.info("HTTP server closed");
      await Promise.allSettled([
        disconnectPrisma().then(() => logger.info("Prisma disconnected")),
        disconnectDatabase().then(() => logger.info("PostgreSQL pool closed")),
      ]);
      logger.info("Shutdown complete");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Forced shutdown after 10s timeout");
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
}

bootstrap().catch((err) => {
  logger.error("Bootstrap failed", { message: err.message, stack: err.stack });
  process.exit(1);
});
