import { z } from "zod";

export const reportTypes = ["parecer", "peca", "relatorio", "analise", "contrato"] as const;
export const reportStatuses = ["rascunho", "gerando", "revisao", "finalizado", "aprovado", "arquivado"] as const;

export const createReportSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  type: z.enum(reportTypes),
  clientId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  area: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
});

export const updateReportSchema = z.object({
  title: z.string().min(3).max(200).trim().optional(),
  type: z.enum(reportTypes).optional(),
  status: z.enum(reportStatuses).optional(),
  clientId: z.string().uuid().nullable().optional(),
  caseId: z.string().uuid().nullable().optional(),
  area: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  content: z.string().max(100000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
});

export const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  type: z.enum(reportTypes).optional(),
  status: z.enum(reportStatuses).optional(),
  clientId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
});

export const generateReportSchema = z.object({
  type: z.enum(reportTypes),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  area: z.string().max(100),
  context: z.string().min(10).max(10000),
  tone: z.enum(["formal", "tecnico", "acessivel"]).default("tecnico"),
  language: z.enum(["pt-BR"]).default("pt-BR"),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type GenerateReportInput = z.infer<typeof generateReportSchema>;
