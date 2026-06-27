import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.render("layouts/main", { title: "Painel de Controle" });
});

export { router as navigationRoutes };
