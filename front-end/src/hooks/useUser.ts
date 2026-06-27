import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionContext";
import type { Role } from "../types/auth";

export function useUser() {
  const { user, isAuthenticated, isLoading, updateUser } = useAuth();
  const perms = usePermissions();

  return {
    user,
    isAuthenticated,
    isLoading,
    updateUser,
    ...perms,

    displayName: user?.full_name || "",
    initials: user?.full_name?.split(" ").filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "",
    email: user?.email || "",
    oab: user?.oab_number && user?.oab_state ? `OAB/${user.oab_state} ${user.oab_number}` : null,
    roleLabel: getRoleLabel(user?.role || null),
    avatarUrl: user?.avatar_url || null,
    office: user?.office_name || null,
    area: user?.area || null,
    comarca: user?.comarca || null,
    specialties: user?.specialties || [],
    isVerified: user?.is_verified || false,
    has2FA: user?.two_factor_enabled || false,
    theme: user?.preferences?.theme || "light",
    language: user?.preferences?.language || "pt-BR",
  };
}

function getRoleLabel(role: Role | null): string {
  if (!role) return "";
  const labels: Record<Role, string> = {
    admin: "Administrador",
    socio: "Sócio",
    advogado: "Advogado",
    associado: "Associado",
    paralegal: "Paralegal",
    secretaria: "Secretária",
    estagiario: "Estagiário",
    cliente: "Cliente",
  };
  return labels[role] || role;
}
