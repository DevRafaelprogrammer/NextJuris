import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { requestId } from "./middleware/request-id";
import { healthRoutes } from "./modules/health/health.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { casesRoutes } from "./modules/cases/cases.routes";
import { clientsRoutes } from "./modules/clients/clients.routes";
import { documentsRoutes } from "./modules/documents/documents.routes";
import { calendarRoutes } from "./modules/calendar/calendar.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { searchRoutes } from "./modules/search/search.routes";

import { sendError } from "./utils/response";
import { StatusCodes } from "http-status-codes";

export function createApp(): express.Application {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  app.use(express.static(path.join(__dirname, "public")));
  app.use(requestId);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  if (env.NODE_ENV !== "test") {
    app.use(morgan("short"));
  }

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" } },
    })
  );

  app.get("/auth", (_req, res) => {
    res.render("layouts/auth", { title: "Autenticacao" });
  });
  app.get("/auth/login", (_req, res) => {
    res.render("layouts/auth", { title: "Entrar" });
  });
  app.get("/auth/register", (_req, res) => {
    res.render("layouts/auth", { title: "Cadastro" });
  });
  app.get("/auth/forgot", (_req, res) => {
    res.render("layouts/auth", { title: "Recuperar Senha" });
  });
  app.get("/logout", (_req, res) => {
    res.redirect("/auth#login");
  });
  app.get("/", (_req, res) => {
    res.render("layouts/main", { title: "Painel de Controle" });
  });
  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/cases", casesRoutes);
  app.use("/api/clients", clientsRoutes);
  app.use("/api/documents", documentsRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/search", searchRoutes);

  app.use((_req, res) => {
    sendError(res, StatusCodes.NOT_FOUND, "ROUTE_NOT_FOUND", "Route not found");
  });

  app.use(errorHandler);

  return app;
}
