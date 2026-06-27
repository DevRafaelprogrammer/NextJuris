import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
import { COOKIE_NAMES } from "../config/cookies";
import { logger } from "../utils/logger";
import { type JwtPayload, extractToken } from "./auth";

interface RouteRule {
  pattern: string | RegExp;
  methods?: string[];
}

const PUBLIC_API_RULES: RouteRule[] = [
  { pattern: "/api/health" },
  { pattern: "/api/health/ready" },
  { pattern: "/api/health/db" },
  { pattern: "/api/health/supabase" },
  { pattern: "/api/auth/login", methods: ["POST"] },
  { pattern: "/api/auth/register", methods: ["POST"] },
  { pattern: /^\/api\/auth\/register\/validate/ },
  { pattern: "/api/auth/register/areas", methods: ["GET"] },
  { pattern: "/api/auth/refresh", methods: ["POST"] },
  { pattern: "/api/auth/forgot-password", methods: ["POST"] },
  { pattern: "/api/auth/reset-password", methods: ["POST"] },
  { pattern: /^\/api\/auth\/google/ },
  { pattern: "/api/errors/catalog", methods: ["GET"] },
];

const PUBLIC_PAGE_PATHS = new Set([
  "/auth", "/auth/login", "/auth/register", "/auth/forgot", "/logout",
]);

const STATIC_EXTENSIONS = new Set([
  ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".map",
]);

function matchesRule(path: string, method: string, rule: RouteRule): boolean {
  const pathMatch = typeof rule.pattern === "string" ? path === rule.pattern : rule.pattern.test(path);
  if (!pathMatch) return false;
  if (rule.methods && !rule.methods.includes(method.toUpperCase())) return false;
  return true;
}

export function isPublicApiRoute(path: string, method: string): boolean {
  return PUBLIC_API_RULES.some(r => matchesRule(path, method, r));
}

export function isPublicPageRoute(path: string): boolean {
  return PUBLIC_PAGE_PATHS.has(path);
}

function isStaticAsset(path: string): boolean {
  const ext = path.substring(path.lastIndexOf("."));
  return STATIC_EXTENSIONS.has(ext) || path.startsWith("/css/") || path.startsWith("/js/") || path.startsWith("/assets/");
}

export function apiGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/")) { next(); return; }
  if (isPublicApiRoute(req.path, req.method)) { next(); return; }

  const { token, source } = extractToken(req);
  if (!token || token === "null" || token === "undefined") { next(); return; }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.type !== "refresh") {
      req.user = payload;
      const now = Math.floor(Date.now() / 1000);
      req.authMeta = {
        tokenSource: source,
        tokenAge: payload.iat ? now - payload.iat : 0,
        expiresIn: payload.exp ? payload.exp - now : 0,
      };
    }
  } catch {}

  next();
}

export function pageGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith("/api/")) { next(); return; }
  if (isPublicPageRoute(req.path)) { next(); return; }
  if (isStaticAsset(req.path)) { next(); return; }

  const { token } = extractToken(req);
  if (!token) {
    const returnTo = req.originalUrl !== "/" ? `?returnTo=${encodeURIComponent(req.originalUrl)}` : "";
    res.redirect(`/auth${returnTo}#login`);
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.type === "refresh") { res.redirect("/auth#login"); return; }
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.redirect("/auth#expired");
    } else {
      res.redirect("/auth#login");
    }
  }
}

export function redirectIfAuthenticated(req: Request, res: Response, next: NextFunction): void {
  const { token } = extractToken(req);
  if (!token) { next(); return; }

  try {
    jwt.verify(token, env.JWT_SECRET);
    const returnTo = (req.query.returnTo as string) || "/";
    res.redirect(returnTo);
  } catch {
    next();
  }
}

const suspiciousPatterns = [
  /\.\.\//,
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /%00/,
  /\x00/,
  /union\s+select/i,
  /;\s*drop\s+/i,
  /--\s*$/,
];

export function requestSanitizer(req: Request, res: Response, next: NextFunction): void {
  const fullUrl = req.originalUrl;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullUrl)) {
      logger.warn("Suspicious request blocked", {
        path: req.path,
        query: req.query,
        ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        pattern: pattern.source,
      });
      res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Requisicao invalida", timestamp: new Date().toISOString() },
      });
      return;
    }
  }

  next();
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") { next(); return; }
  if (req.path.startsWith("/api/auth/login") || req.path.startsWith("/api/auth/register") || req.path.startsWith("/api/auth/refresh")) { next(); return; }

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) { next(); return; }

  const allowed = [
    `http://localhost:${env.PORT || 3000}`,
    `http://localhost:5173`,
    env.CORS_ORIGIN,
  ].filter(Boolean);

  const originHost = origin.replace(/\/$/, "");
  if (!allowed.some(a => originHost.startsWith(a as string))) {
    logger.warn("CSRF: origin mismatch", { origin, allowed });
    res.status(403).json({
      success: false,
      error: { code: "CSRF_VIOLATION", message: "Origem da requisicao nao permitida", timestamp: new Date().toISOString() },
    });
    return;
  }

  next();
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function sensitiveRouteThrottle(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.path}:${req.user?.sub || req.socket.remoteAddress || "anon"}`;
    const now = Date.now();
    const entry = requestCounts.get(key);

    if (!entry || now > entry.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: "ROUTE_RATE_LIMIT",
          message: `Limite excedido para esta operacao. Aguarde ${retryAfter}s.`,
          context: { retryAfter },
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts) {
    if (now > entry.resetAt) requestCounts.delete(key);
  }
}, 60000);
