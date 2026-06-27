import { Request, Response, NextFunction } from "express";
import { ForbiddenError, InsufficientPermissionError } from "../utils/errors";

export type Role = "admin" | "advogado" | "socio" | "associado" | "estagiario" | "secretaria" | "paralegal" | "cliente";

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  socio: 80,
  advogado: 60,
  associado: 50,
  paralegal: 40,
  secretaria: 30,
  estagiario: 20,
  cliente: 10,
};

export const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  admin: new Set([
    "users:read", "users:write", "users:delete", "users:manage-roles",
    "reports:read", "reports:write", "reports:delete", "reports:generate", "reports:approve",
    "cases:read", "cases:write", "cases:delete",
    "clients:read", "clients:write", "clients:delete",
    "documents:read", "documents:write", "documents:delete",
    "calendar:read", "calendar:write", "calendar:delete",
    "financials:read", "financials:write", "financials:delete", "financials:approve",
    "dashboard:read", "dashboard:admin",
    "settings:read", "settings:write",
    "audit:read",
  ]),
  socio: new Set([
    "users:read",
    "reports:read", "reports:write", "reports:generate", "reports:approve",
    "cases:read", "cases:write",
    "clients:read", "clients:write",
    "documents:read", "documents:write",
    "calendar:read", "calendar:write",
    "financials:read", "financials:write", "financials:approve",
    "dashboard:read",
    "settings:read",
  ]),
  advogado: new Set([
    "reports:read", "reports:write", "reports:generate",
    "cases:read", "cases:write",
    "clients:read", "clients:write",
    "documents:read", "documents:write",
    "calendar:read", "calendar:write",
    "financials:read",
    "dashboard:read",
  ]),
  associado: new Set([
    "reports:read", "reports:write", "reports:generate",
    "cases:read", "cases:write",
    "clients:read",
    "documents:read", "documents:write",
    "calendar:read", "calendar:write",
    "dashboard:read",
  ]),
  paralegal: new Set([
    "reports:read", "reports:write",
    "cases:read",
    "clients:read",
    "documents:read", "documents:write",
    "calendar:read", "calendar:write",
    "dashboard:read",
  ]),
  secretaria: new Set([
    "cases:read",
    "clients:read", "clients:write",
    "documents:read",
    "calendar:read", "calendar:write",
    "dashboard:read",
  ]),
  estagiario: new Set([
    "reports:read",
    "cases:read",
    "clients:read",
    "documents:read",
    "calendar:read",
    "dashboard:read",
  ]),
  cliente: new Set([
    "cases:read",
    "documents:read",
    "calendar:read",
  ]),
};

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new ForbiddenError("Autenticacao necessaria");
    const userRole = req.user.role as Role;
    if (!roles.includes(userRole)) {
      throw new InsufficientPermissionError(roles.join(", "));
    }
    next();
  };
}

export function requireMinRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new ForbiddenError("Autenticacao necessaria");
    const userLevel = ROLE_HIERARCHY[req.user.role as Role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel < requiredLevel) {
      throw new InsufficientPermissionError(minRole);
    }
    next();
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new ForbiddenError("Autenticacao necessaria");
    const userPerms = ROLE_PERMISSIONS[req.user.role as Role];
    if (!userPerms) throw new InsufficientPermissionError(permissions.join(", "));
    const missing = permissions.filter(p => !userPerms.has(p));
    if (missing.length > 0) {
      throw new InsufficientPermissionError(missing.join(", "));
    }
    next();
  };
}

export function hasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  return perms ? perms.has(permission) : false;
}

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role as Role] || 0;
}

export function getPermissions(role: string): string[] {
  const perms = ROLE_PERMISSIONS[role as Role];
  return perms ? [...perms] : [];
}
