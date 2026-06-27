import { z } from "zod";

export const njUserRoles = ["admin", "advogado", "socio", "associado", "estagiario", "secretaria", "paralegal", "cliente"] as const;
export const njUserStatuses = ["ativo", "inativo", "suspenso", "pendente"] as const;

export const createUserSchema = z.object({
  fullName: z.string().min(3).max(200).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().max(20).optional(),
  cpf: z.string().min(11).max(14).optional(),
  oabNumber: z.string().max(10).optional(),
  oabState: z.string().length(2).toUpperCase().optional(),
  role: z.enum(njUserRoles).default("advogado"),
  officeName: z.string().max(200).optional(),
  officeCnpj: z.string().max(18).optional(),
  area: z.string().max(100).optional(),
  comarca: z.string().max(100).optional(),
  specialties: z.array(z.string().max(50)).max(10).default([]),
  bio: z.string().max(2000).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(3).max(200).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().max(20).nullable().optional(),
  cpf: z.string().min(11).max(14).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  oabNumber: z.string().max(10).nullable().optional(),
  oabState: z.string().length(2).toUpperCase().nullable().optional(),
  role: z.enum(njUserRoles).optional(),
  status: z.enum(njUserStatuses).optional(),
  officeName: z.string().max(200).nullable().optional(),
  officeCnpj: z.string().max(18).nullable().optional(),
  area: z.string().max(100).nullable().optional(),
  comarca: z.string().max(100).nullable().optional(),
  specialties: z.array(z.string().max(50)).max(10).optional(),
  bio: z.string().max(2000).nullable().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  language: z.enum(["pt-BR", "en-US"]).optional(),
  notifications_email: z.boolean().optional(),
  notifications_push: z.boolean().optional(),
  notifications_sms: z.boolean().optional(),
  timezone: z.string().max(50).optional(),
  date_format: z.string().max(20).optional(),
  items_per_page: z.number().int().min(5).max(100).optional(),
  sidebar_collapsed: z.boolean().optional(),
  default_report_type: z.string().max(30).optional(),
  default_area: z.string().max(100).nullable().optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "fullName", "lastLoginAt", "loginCount"]).default("fullName"),
  order: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().optional(),
  role: z.enum(njUserRoles).optional(),
  status: z.enum(njUserStatuses).optional(),
  office: z.string().optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid("ID de usuario invalido"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
