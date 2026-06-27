import { type ReactNode, type ComponentType, useMemo } from "react";
import { usePermissions } from "../contexts/PermissionContext";
import type { Role } from "../types/auth";

interface CanProps {
  permission?: string | string[];
  role?: Role | Role[];
  minRole?: Role;
  maxRole?: Role;
  not?: boolean;
  fallback?: ReactNode;
  children: ReactNode | ((allowed: boolean) => ReactNode);
}

export function Can({ permission, role, minRole, maxRole, not = false, fallback = null, children }: CanProps) {
  const perms = usePermissions();
  const allowed = useMemo(() => {
    let result = true;
    if (permission) {
      const ps = Array.isArray(permission) ? permission : [permission];
      result = perms.canAll(...ps);
    }
    if (role) {
      const rs = Array.isArray(role) ? role : [role];
      result = result && perms.hasRole(...rs);
    }
    if (minRole) result = result && perms.hasMinRole(minRole);
    if (maxRole) result = result && perms.hasMaxRole(maxRole);
    return not ? !result : result;
  }, [permission, role, minRole, maxRole, not, perms]);

  if (typeof children === "function") return <>{children(allowed)}</>;
  return allowed ? <>{children}</> : <>{fallback}</>;
}

export function CanAny({ permissions, children, fallback = null }: { permissions: string[]; children: ReactNode; fallback?: ReactNode }) {
  const { canAny } = usePermissions();
  return canAny(...permissions) ? <>{children}</> : <>{fallback}</>;
}

export function CanAll({ permissions, children, fallback = null }: { permissions: string[]; children: ReactNode; fallback?: ReactNode }) {
  const { canAll } = usePermissions();
  return canAll(...permissions) ? <>{children}</> : <>{fallback}</>;
}

export function AdminOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { isAdmin } = usePermissions();
  return isAdmin ? <>{children}</> : <>{fallback}</>;
}

export function SocioOrAbove({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { hasMinRole } = usePermissions();
  return hasMinRole("socio") ? <>{children}</> : <>{fallback}</>;
}

export function AdvogadoOrAbove({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { hasMinRole } = usePermissions();
  return hasMinRole("advogado") ? <>{children}</> : <>{fallback}</>;
}

interface RoleSwitchProps {
  cases: Partial<Record<Role | "default", ReactNode>>;
}

export function RoleSwitch({ cases }: RoleSwitchProps) {
  const { role } = usePermissions();
  if (!role) return <>{cases.default || null}</>;
  return <>{cases[role] ?? cases.default ?? null}</>;
}

interface RoleBadgeProps {
  role?: Role;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const ROLE_CONFIG: Record<Role, { label: string; color: string; icon: string }> = {
  admin: { label: "Administrador", color: "#C0392B", icon: "⚙" },
  socio: { label: "Sócio", color: "#C9AA71", icon: "★" },
  advogado: { label: "Advogado", color: "#1D9E75", icon: "⚖" },
  associado: { label: "Associado", color: "#378ADD", icon: "◆" },
  paralegal: { label: "Paralegal", color: "#D85A30", icon: "◇" },
  secretaria: { label: "Secretária", color: "#7F77DD", icon: "▣" },
  estagiario: { label: "Estagiário", color: "#8FA3B1", icon: "○" },
  cliente: { label: "Cliente", color: "#888780", icon: "●" },
};

export function RoleBadge({ role: overrideRole, size = "sm", showIcon = false }: RoleBadgeProps = {}) {
  const { role: contextRole } = usePermissions();
  const role = overrideRole || contextRole;
  if (!role) return null;
  const cfg = ROLE_CONFIG[role] || { label: role, color: "#888", icon: "?" };
  const sizes = { sm: { fontSize: 11, padding: "2px 8px" }, md: { fontSize: 12, padding: "3px 10px" }, lg: { fontSize: 13, padding: "4px 14px" } };
  const s = sizes[size];
  return (
    <span style={{ ...s, fontWeight: 500, borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: `${cfg.color}15`, color: cfg.color, border: `0.5px solid ${cfg.color}30` }}>
      {showIcon && <span>{cfg.icon}</span>}
      {cfg.label}
    </span>
  );
}

export function RoleLabel({ role: overrideRole }: { role?: Role } = {}) {
  const { role: contextRole } = usePermissions();
  const role = overrideRole || contextRole;
  if (!role) return null;
  return <>{ROLE_CONFIG[role]?.label || role}</>;
}

export function PermissionGate({ requires, mode = "all", children, denied }: { requires: string[]; mode?: "all" | "any"; children: ReactNode; denied?: ReactNode }) {
  const { canAll, canAny } = usePermissions();
  const allowed = mode === "all" ? canAll(...requires) : canAny(...requires);
  return allowed ? <>{children}</> : <>{denied || null}</>;
}

export function withRole<P extends object>(...roles: Role[]) {
  return (Component: ComponentType<P>) => {
    return function RoleGuarded(props: P) {
      const { hasRole } = usePermissions();
      if (!hasRole(...roles)) return null;
      return <Component {...props} />;
    };
  };
}

export function withPermission<P extends object>(...permissions: string[]) {
  return (Component: ComponentType<P>) => {
    return function PermissionGuarded(props: P) {
      const { canAll } = usePermissions();
      if (!canAll(...permissions)) return null;
      return <Component {...props} />;
    };
  };
}

export function withMinRole<P extends object>(minRole: Role) {
  return (Component: ComponentType<P>) => {
    return function MinRoleGuarded(props: P) {
      const { hasMinRole } = usePermissions();
      if (!hasMinRole(minRole)) return null;
      return <Component {...props} />;
    };
  };
}

interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  path?: string;
  permission?: string;
  role?: Role | Role[];
  minRole?: Role;
  children?: MenuItem[];
  badge?: string | number;
}

export function useFilteredMenu(items: MenuItem[]): MenuItem[] {
  const perms = usePermissions();

  return useMemo(() => {
    function filter(list: MenuItem[]): MenuItem[] {
      return list.filter(item => {
        if (item.permission && !perms.can(item.permission)) return false;
        if (item.role) {
          const roles = Array.isArray(item.role) ? item.role : [item.role];
          if (!perms.hasRole(...roles)) return false;
        }
        if (item.minRole && !perms.hasMinRole(item.minRole)) return false;
        return true;
      }).map(item => ({
        ...item,
        children: item.children ? filter(item.children) : undefined,
      }));
    }
    return filter(items);
  }, [items, perms]);
}

export function useRoleActions() {
  const perms = usePermissions();

  return useMemo(() => ({
    canCreateReport: perms.can("reports:write"),
    canGenerateIA: perms.can("reports:generate"),
    canApproveReport: perms.can("reports:approve"),
    canDeleteReport: perms.can("reports:delete"),
    canManageCases: perms.canAll("cases:read", "cases:write"),
    canManageClients: perms.canAll("clients:read", "clients:write"),
    canViewFinancials: perms.can("financials:read"),
    canApproveFinancials: perms.can("financials:approve"),
    canManageUsers: perms.can("users:write"),
    canDeleteUsers: perms.can("users:delete"),
    canChangeRoles: perms.can("users:manage-roles"),
    canViewAudit: perms.can("audit:read"),
    canAccessAdmin: perms.isAdmin,
    canAccessSettings: perms.can("settings:read"),
    canWriteSettings: perms.can("settings:write"),
  }), [perms]);
}
