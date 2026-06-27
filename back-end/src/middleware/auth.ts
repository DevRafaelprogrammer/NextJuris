import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { COOKIE_NAMES } from "../config/cookies";
import {
  UnauthorizedError,
  TokenExpiredError,
  TokenInvalidError,
  InsufficientPermissionError,
} from "../utils/errors";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name?: string;
  type?: "access" | "refresh";
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const t = header.slice(7);
    if (t && t !== "null" && t !== "undefined") return t;
  }

  const signed = (req as any).signedCookies;
  if (signed?.[COOKIE_NAMES.ACCESS_TOKEN]) return signed[COOKIE_NAMES.ACCESS_TOKEN];

  return null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    throw new UnauthorizedError("Autenticacao necessaria", {
      constraint: "Envie Bearer token no header ou cookie de sessao",
    });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.type === "refresh") throw new TokenInvalidError();
    req.user = payload;
    next();
  } catch (err: any) {
    if (err instanceof TokenInvalidError || err instanceof TokenExpiredError) throw err;
    if (err.name === "TokenExpiredError") throw new TokenExpiredError();
    if (err.name === "JsonWebTokenError") throw new TokenInvalidError();
    throw new UnauthorizedError("Falha na autenticacao");
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError("Autenticacao necessaria");
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      throw new InsufficientPermissionError(roles.join(" ou "));
    }
    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { next(); return; }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.type !== "refresh") req.user = payload;
  } catch {}
  next();
}
