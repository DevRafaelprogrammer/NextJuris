import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import jwt from "jsonwebtoken";
import { env } from "./config/env";
import { errorHandler, notFoundHandler, getErrorMetrics } from "./middleware/error-handler";
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
import { sendSuccess } from "./utils/response";
import { ERROR_CATALOG } from "./utils/errors";

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";
  },
  message: {
    success: false,
    error: {
      code: "AUTH_RATE_LIMIT",
      message: "Muitas tentativas de login. Aguarde 15 minutos.",
      timestamp: new Date().toISOString(),
    },
  },
});

const forgotRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "FORGOT_RATE_LIMIT",
      message: "Muitas solicitacoes de redefinicao. Aguarde 1 hora.",
      timestamp: new Date().toISOString(),
    },
  },
});

export function createApp(): express.Application {
  const app = express();

  const frontendDir = path.resolve(__dirname, "..", "..", "front-end");

  app.set("view engine", "ejs");
  app.set("views", path.join(frontendDir, "views"));

  app.use(express.static(path.join(frontendDir, "public")));
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
    "/api",
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: "TOO_MANY_REQUESTS", message: "Limite de requisicoes excedido", timestamp: new Date().toISOString() },
      },
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

  app.get("/logout", (req, res) => {
    res.setHeader("Clear-Site-Data", '"cookies", "storage"');
    res.redirect("/auth#login");
  });

  app.get("/", (req, res) => {
    const authHeader = req.headers.authorization;
    const cookieToken = req.headers.cookie?.match(/nj_access_token=([^;]+)/)?.[1];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

    res.render("layouts/main", { title: "Painel de Controle" });
  });

  app.use("/api/health", healthRoutes);

  app.post("/api/auth/login", authRateLimit);
  app.post("/api/auth/register", authRateLimit);
  app.post("/api/auth/forgot-password", forgotRateLimit);

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/cases", casesRoutes);
  app.use("/api/clients", clientsRoutes);
  app.use("/api/documents", documentsRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/search", searchRoutes);

  app.get("/api/errors/catalog", (_req, res) => {
    sendSuccess(res, ERROR_CATALOG);
  });

  app.get("/api/errors/metrics", (_req, res) => {
    sendSuccess(res, getErrorMetrics());
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
