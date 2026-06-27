import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version ?? "1.0.0",
  });
});

router.get("/ready", (_req: Request, res: Response) => {
  res.json({ status: "ready" });
});

export { router as healthRoutes };
