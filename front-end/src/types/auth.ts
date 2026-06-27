export type Role = "admin" | "advogado" | "socio" | "associado" | "estagiario" | "secretaria" | "paralegal" | "cliente";

export type UserStatus = "ativo" | "inativo" | "suspenso" | "pendente";

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  avatar_url: string | null;
  oab_number: string | null;
  oab_state: string | null;
  role: Role;
  status: UserStatus;
  office_name: string | null;
  area: string | null;
  comarca: string | null;
  specialties: string[];
  bio: string | null;
  is_verified: boolean;
  last_login_at: string | null;
  login_count: number;
  two_factor_enabled: boolean;
  preferences: UserPreferences;
  permissions: string[];
  created_at: string;
}

export interface UserPreferences {
  theme: "light" | "dark";
  language: "pt-BR" | "en-US";
  notifications_email: boolean;
  notifications_push: boolean;
  notifications_sms: boolean;
  timezone: string;
  date_format: string;
  items_per_page: number;
  sidebar_collapsed: boolean;
  default_report_type: string | null;
  default_area: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: User;
  tokens: TokenPair;
  permissions: string[];
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  cpf?: string;
  phone?: string;
  oabNumber?: string;
  oabState?: string;
  officeName?: string;
  area?: string;
  comarca?: string;
  specialties?: string[];
  acceptTerms?: boolean;
  acceptLgpd?: boolean;
}
