import { api } from "./client";
import type { Role } from "../types/auth";

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  oab_number: string | null;
  oab_state: string | null;
  role: Role;
  status: string;
  office_name: string | null;
  area: string | null;
  is_verified: boolean;
  last_login_at: string | null;
  login_count: number;
  failed_login_count: number;
  locked_until: string | null;
  two_factor_enabled: boolean;
  created_at: string;
  permissions: string[];
  roleLevel: number;
  isLocked: boolean;
}

export interface AdminOverview {
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number>; active7d: number; active30d: number; newUsers30d: number; verified: number };
  reports: { total: number; byStatus: Record<string, number>; iaGenerated: number; iaPercentage: number };
  cases: { total: number; byPhase: Record<string, number>; totalValue: number };
  security: { recentLogins: number; loginSuccess: number; loginFailed: number; failRate: number };
  system: { uptime: number; memory: { rss: number; heapUsed: number }; nodeVersion: string };
}

export interface AuditEntry {
  id: string;
  user_id: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  created_at: string;
  user: { id: string; full_name: string; email: string; role: string } | null;
}

export const adminApi = {
  overview: () => api.get<AdminOverview>("/admin/overview"),
  users: (params?: Record<string, unknown>) => api.get<{ data: AdminUser[]; meta: { total: number; page: number; totalPages: number } }>("/admin/users", params),
  userDetail: (id: string) => api.get<{ user: AdminUser; sessions: unknown[]; loginHistory: unknown[]; recentReports: unknown[] }>(`/admin/users/${id}`),
  changeRole: (id: string, role: Role) => api.patch<AdminUser>(`/admin/users/${id}/role`, { role }),
  activateUser: (id: string) => api.post<AdminUser>(`/admin/users/${id}/activate`),
  suspendUser: (id: string) => api.post<AdminUser>(`/admin/users/${id}/suspend`),
  unlockUser: (id: string) => api.post<AdminUser>(`/admin/users/${id}/unlock`),
  revokeSessions: (id: string) => api.post<{ revokedCount: number }>(`/admin/users/${id}/revoke-sessions`),
  deleteUser: (id: string) => api.del(`/admin/users/${id}`),
  audit: (limit?: number) => api.get<{ entries: AuditEntry[]; total: number }>("/admin/audit", { limit }),
  system: () => api.get<Record<string, unknown>>("/admin/system"),
};
