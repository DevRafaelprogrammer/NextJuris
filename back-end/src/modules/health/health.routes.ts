import { Router, Request, Response } from "express";
import { getDatabaseStatus, getTableStats, isConnected } from "../../config/database";
import { getSupabase } from "../../config/supabase";
import { asyncHandler } from "../../utils/async-handler";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({
    status: isConnected() ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version ?? "1.0.0",
    database: isConnected() ? "connected" : "disconnected",
  });
});

router.get("/ready", asyncHandler(async (_req: Request, res: Response) => {
  const dbStatus = await getDatabaseStatus();

  if (!dbStatus.connected) {
    res.status(503).json({ status: "not_ready", database: dbStatus });
    return;
  }

  res.json({ status: "ready", database: { connected: true, latency: dbStatus.latency } });
}));

router.get("/db", asyncHandler(async (_req: Request, res: Response) => {
  const dbStatus = await getDatabaseStatus();
  let tables: Record<string, number> = {};

  if (dbStatus.connected) {
    try { tables = await getTableStats(); } catch { tables = {}; }
  }

  const statusCode = dbStatus.connected ? 200 : 503;
  res.status(statusCode).json({
    status: dbStatus.connected ? "connected" : "disconnected",
    ...dbStatus,
    tables,
  });
}));

router.get("/supabase", asyncHandler(async (_req: Request, res: Response) => {
  const start = performance.now();
  const db = getSupabase();

  const { data, error } = await db.from("users").select("id", { count: "exact", head: true }).limit(0);
  const latency = Math.round(performance.now() - start);

  res.json({
    status: error ? "error" : "connected",
    latency,
    error: error?.message ?? null,
  });
}));

export { router as healthRoutes };
