import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
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

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Header de autorizacao ausente ou invalido", {
      constraint: "Formato esperado: Authorization: Bearer <token>",
    });
  }

  const token = header.slice(7);
  if (!token || token === "null" || token === "undefined") {
    throw new TokenInvalidError();
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (payload.type === "refresh") {
      throw new TokenInvalidError();
    }

    req.user = payload;
    next();
  } catch (err: any) {
    if (err instanceof TokenInvalidError || err instanceof TokenExpiredError) throw err;
    if (err.name === "TokenExpiredError") throw new TokenExpiredError();
    if (err.name === "JsonWebTokenError") throw new TokenInvalidError();
    if (err.name === "NotBeforeError") throw new TokenInvalidError();
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
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.type !== "refresh") req.user = payload;
  } catch {}
  next();
}
