import { api } from "./client";
import type { AuthResult, LoginInput, RegisterInput, User, TokenPair } from "../types/auth";

export const authApi = {
  login: (data: LoginInput) => api.post<AuthResult>("/auth/login", data),
  register: (data: RegisterInput) => api.post<AuthResult>("/auth/register", data),
  me: () => api.get<User>("/auth/me"),
  refresh: () => api.post<TokenPair>("/auth/refresh"),
  logout: () => api.post<{ loggedOut: boolean }>("/auth/logout"),
  logoutAll: () => api.post<{ revokedSessions: number }>("/auth/logout-all"),
  forgotPassword: (email: string) => api.post<{ sent: boolean }>("/auth/forgot-password", { email }),
  resetPassword: (data: { token: string; password: string; confirmPassword: string }) => api.post<{ reset: boolean }>("/auth/reset-password", data),
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => api.post<{ changed: boolean }>("/auth/change-password", data),
  sessions: () => api.get<Array<{ id: string; ip_address: string; user_agent: string; created_at: string }>>("/auth/sessions"),
  revokeSession: (id: string) => api.del(`/auth/sessions/${id}`),
};
