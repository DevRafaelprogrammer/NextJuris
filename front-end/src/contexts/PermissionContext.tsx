import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { Role } from "../types/auth";

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100, socio: 80, advogado: 60, associado: 50,
  paralegal: 40, secretaria: 30, estagiario: 20, cliente: 10,
};

interface PermissionContextValue {
  permissions: string[];
  role: Role | null;
  roleLevel: number;
  can: (permission: string) => boolean;
  canAll: (...permissions: string[]) => boolean;
  canAny: (...permissions: string[]) => boolean;
  hasRole: (...roles: Role[]) => boolean;
  hasMinRole: (minRole: Role) => boolean;
  hasMaxRole: (maxRole: Role) => boolean;
  isAdmin: boolean;
  isSocio: boolean;
  isAdvogado: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const value = useMemo<PermissionContextValue>(() => {
    const permissions = user?.permissions || [];
    const role = (user?.role || null) as Role | null;
    const roleLevel = role ? (ROLE_HIERARCHY[role] || 0) : 0;
    const permSet = new Set(permissions);

    return {
      permissions,
      role,
      roleLevel,
      can: (p: string) => permSet.has(p),
      canAll: (...ps: string[]) => ps.every(p => permSet.has(p)),
      canAny: (...ps: string[]) => ps.some(p => permSet.has(p)),
      hasRole: (...roles: Role[]) => !!role && roles.includes(role),
      hasMinRole: (min: Role) => roleLevel >= (ROLE_HIERARCHY[min] || 0),
      hasMaxRole: (max: Role) => roleLevel <= (ROLE_HIERARCHY[max] || 0),
      isAdmin: role === "admin",
      isSocio: role === "socio" || role === "admin",
      isAdvogado: roleLevel >= ROLE_HIERARCHY.advogado,
    };
  }, [user]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error("usePermissions must be used within PermissionProvider");
  return ctx;
}
