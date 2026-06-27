import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { COOKIE_NAMES } from "../config/cookies";
import { JwtPayload } from "./auth";

const PUBLIC_API_ROUTES = new Set([
  "/api/health",
  "/api/health/ready",
  "/api/health/db",
  "/api/health/supabase",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/register/validate/step1",
  "/api/auth/register/validate/step2",
  "/api/auth/register/validate/step3",
  "/api/auth/register/validate/field",
  "/api/auth/register/areas",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/errors/catalog",
]);

const PUBLIC_PAGE_ROUTES = new Set([
  "/auth",
  "/auth/login",
  "/auth/register",
  "/auth/forgot",
  "/logout",
]);

export function isPublicRoute(path: string): boolean {
  if (PUBLIC_API_ROUTES.has(path)) return true;
  if (PUBLIC_PAGE_ROUTES.has(path)) return true;
  if (!path.startsWith("/api/")) return true;
  return false;
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  const signedCookies = (req as any).signedCookies;
  if (signedCookies?.[COOKIE_NAMES.ACCESS_TOKEN]) return signedCookies[COOKIE_NAMES.ACCESS_TOKEN];

  return null;
}

export function apiGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/")) { next(); return; }
  if (isPublicRoute(req.path)) { next(); return; }

  const token = extractToken(req);
  if (!token || token === "null" || token === "undefined") {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.type !== "refresh") {
      req.user = payload;
    }
  } catch {}

  next();
}

export function pageGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith("/api/")) { next(); return; }
  if (PUBLIC_PAGE_ROUTES.has(req.path)) { next(); return; }
  if (req.path.startsWith("/css/") || req.path.startsWith("/js/") || req.path.includes(".")) { next(); return; }

  const token = extractToken(req);
  if (!token) {
    res.redirect("/auth#login");
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.type === "refresh") { res.redirect("/auth#login"); return; }
    req.user = payload;
    next();
  } catch {
    res.redirect("/auth#login");
  }
}

export function redirectIfAuthenticated(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { next(); return; }

  try {
    jwt.verify(token, env.JWT_SECRET);
    res.redirect("/");
  } catch {
    next();
  }
}
