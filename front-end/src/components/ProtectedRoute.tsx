import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionContext";
import type { Role } from "../types/auth";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  requiredRole?: Role | Role[];
  requiredPermission?: string | string[];
  minRole?: Role;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, requiredRole, requiredPermission, minRole, fallback, redirectTo = "/auth" }: Props) {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasRole, canAll, hasMinRole } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return fallback || <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!hasRole(...roles)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  if (minRole && !hasMinRole(minRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredPermission) {
    const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    if (!canAll(...perms)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}
