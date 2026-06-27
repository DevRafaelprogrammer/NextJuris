import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { COOKIE_NAMES } from "../config/cookies";
import {
  UnauthorizedError,
  TokenExpiredError,
  TokenInvalidError,
  InsufficientPermissionError,
  ForbiddenError,
  AccountSuspendedError,
} from "../utils/errors";
import { logger } from "../utils/logger";
import { getSupabase } from "../config/supabase";
import { type Role, ROLE_HIERARCHY, ROLE_PERMISSIONS, hasPermission } from "./roles";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name?: string;
  type?: "access" | "refresh";
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      authMeta?: {
        tokenSource: "header" | "cookie" | "none";
        tokenAge: number;
        expiresIn: number;
      };
    }
  }
}

export function extractToken(req: Request): { token: string | null; source: "header" | "cookie" | "none" } {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const t = header.slice(7);
    if (t && t !== "null" && t !== "undefined") return { token: t, source: "header" };
  }

  const signed = (req as any).signedCookies;
  if (signed?.[COOKIE_NAMES.ACCESS_TOKEN]) return { token: signed[COOKIE_NAMES.ACCESS_TOKEN], source: "cookie" };

  return { token: null, source: "none" };
}

function verifyAndDecode(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.type === "refresh") throw new TokenInvalidError();
    return payload;
  } catch (err: any) {
    if (err instanceof TokenInvalidError || err instanceof TokenExpiredError) throw err;
    if (err.name === "TokenExpiredError") throw new TokenExpiredError();
    if (err.name === "JsonWebTokenError") throw new TokenInvalidError();
    if (err.name === "NotBeforeError") throw new TokenInvalidError();
    throw new UnauthorizedError("Falha na autenticacao");
  }
}

function attachMeta(req: Request, payload: JwtPayload, source: "header" | "cookie" | "none"): void {
  const now = Math.floor(Date.now() / 1000);
  req.authMeta = {
    tokenSource: source,
    tokenAge: payload.iat ? now - payload.iat : 0,
    expiresIn: payload.exp ? payload.exp - now : 0,
  };
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const { token, source } = extractToken(req);

  if (!token) {
    throw new UnauthorizedError("Autenticacao necessaria", {
      constraint: "Envie Bearer token no header Authorization ou use cookie de sessao",
    });
  }

  const payload = verifyAndDecode(token);
  req.user = payload;
  attachMeta(req, payload, source);
  next();
}

export function authenticateAndVerifyStatus(req: Request, _res: Response, next: NextFunction): void {
  const { token, source } = extractToken(req);

  if (!token) {
    throw new UnauthorizedError("Autenticacao necessaria");
  }

  const payload = verifyAndDecode(token);
  req.user = payload;
  attachMeta(req, payload, source);

  const db = getSupabase();
  Promise.resolve(
    db.from("users").select("status, locked_until").eq("id", payload.sub).is("deleted_at", null).single()
  ).then(({ data }) => {
    if (!data) { next(new UnauthorizedError("Usuario nao encontrado")); return; }
    if (data.status === "suspenso") { next(new AccountSuspendedError()); return; }
    if (data.status === "inativo") { next(new ForbiddenError("Conta inativa")); return; }
    if (data.locked_until && new Date(data.locked_until) > new Date()) {
      next(new ForbiddenError("Conta temporariamente bloqueada"));
      return;
    }
    next();
  }).catch(() => next());
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const { token, source } = extractToken(req);
  if (!token) { next(); return; }

  try {
    const payload = verifyAndDecode(token);
    req.user = payload;
    attachMeta(req, payload, source);
  } catch {}
  next();
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

export function requireOwnership(paramName = "id") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    const resourceId = Array.isArray(req.params[paramName]) ? req.params[paramName][0] : req.params[paramName];
    if (resourceId === req.user.sub) { next(); return; }

    const userLevel = ROLE_HIERARCHY[req.user.role as Role] || 0;
    if (userLevel >= ROLE_HIERARCHY.socio) { next(); return; }

    throw new ForbiddenError("Acesso permitido apenas ao proprietario do recurso ou gestores");
  };
}

export function requireOwnershipOrPermission(paramName: string, permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    const resourceId = Array.isArray(req.params[paramName]) ? req.params[paramName][0] : req.params[paramName];
    if (resourceId === req.user.sub) { next(); return; }
    if (hasPermission(req.user.role, permission)) { next(); return; }

    throw new ForbiddenError("Acesso ao recurso negado");
  };
}

export function logAuthAction(action: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user) {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress;
      logger.info(`AUTH_ACTION: ${action}`, {
        userId: req.user.sub,
        email: req.user.email,
        role: req.user.role,
        ip,
        path: req.originalUrl,
        method: req.method,
        tokenSource: req.authMeta?.tokenSource,
      });
    }
    next();
  };
}

export function requireFreshToken(maxAgeSeconds = 300) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !req.authMeta) throw new UnauthorizedError();
    if (req.authMeta.tokenAge > maxAgeSeconds) {
      throw new UnauthorizedError("Operacao sensivel requer reautenticacao", {
        constraint: `Token deve ter menos de ${Math.ceil(maxAgeSeconds / 60)} minutos`,
        retryAfter: 0,
      });
    }
    next();
  };
}

type MiddlewareFn = (req: Request, res: Response, next: NextFunction) => void;

export function compose(...middlewares: MiddlewareFn[]): MiddlewareFn {
  return (req: Request, res: Response, next: NextFunction): void => {
    let index = 0;
    function run(err?: unknown): void {
      if (err) { next(err); return; }
      if (index >= middlewares.length) { next(); return; }
      const mw = middlewares[index++];
      try {
        mw(req, res, run);
      } catch (e) {
        next(e);
      }
    }
    run();
  };
}

export const auth = {
  required: authenticate,
  requiredStrict: authenticateAndVerifyStatus,
  optional: optionalAuth,
  roles: authorize,
  owner: requireOwnership,
  ownerOr: requireOwnershipOrPermission,
  fresh: requireFreshToken,
  log: logAuthAction,
  compose,
};
