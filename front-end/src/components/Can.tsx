import type { ReactNode } from "react";
import { usePermissions } from "../contexts/PermissionContext";
import type { Role } from "../types/auth";

interface CanProps {
  permission?: string | string[];
  role?: Role | Role[];
  minRole?: Role;
  not?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permission, role, minRole, not = false, fallback = null, children }: CanProps) {
  const { canAll, hasRole, hasMinRole } = usePermissions();

  let allowed = true;

  if (permission) {
    const perms = Array.isArray(permission) ? permission : [permission];
    allowed = canAll(...perms);
  }

  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    allowed = allowed && hasRole(...roles);
  }

  if (minRole) {
    allowed = allowed && hasMinRole(minRole);
  }

  if (not) allowed = !allowed;

  return allowed ? <>{children}</> : <>{fallback}</>;
}

export function CanAny({ permissions, fallback = null, children }: { permissions: string[]; fallback?: ReactNode; children: ReactNode }) {
  const { canAny } = usePermissions();
  return canAny(...permissions) ? <>{children}</> : <>{fallback}</>;
}

export function AdminOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { isAdmin } = usePermissions();
  return isAdmin ? <>{children}</> : <>{fallback}</>;
}

export function RoleBadge() {
  const { role } = usePermissions();
  if (!role) return null;
  const colors: Record<string, string> = {
    admin: "#C0392B", socio: "#C9AA71", advogado: "#1D9E75",
    associado: "#378ADD", estagiario: "#8FA3B1", secretaria: "#7F77DD",
    paralegal: "#D85A30", cliente: "#888780",
  };
  const labels: Record<string, string> = {
    admin: "Admin", socio: "Sócio", advogado: "Advogado", associado: "Associado",
    estagiario: "Estagiário", secretaria: "Secretária", paralegal: "Paralegal", cliente: "Cliente",
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 10,
      backgroundColor: `${colors[role]}15`, color: colors[role], border: `0.5px solid ${colors[role]}30`,
    }}>
      {labels[role] || role}
    </span>
  );
}
