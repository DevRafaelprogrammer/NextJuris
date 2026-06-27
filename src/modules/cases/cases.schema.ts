import { z } from "zod";

export const casePhases = ["conhecimento", "instrucao", "recurso", "execucao", "conciliacao", "arquivado"] as const;

export const createCaseSchema = z.object({
  number: z.string().min(10).max(30).trim(),
  parties: z.string().min(3).max(300).trim(),
  court: z.string().min(3).max(200).trim(),
  judge: z.string().max(200).optional(),
  area: z.string().max(100),
  phase: z.enum(casePhases).default("conhecimento"),
  clientId: z.string().uuid().optional(),
  value: z.number().min(0).optional(),
  description: z.string().max(5000).optional(),
});

export const updateCaseSchema = createCaseSchema.partial();

export const listCasesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "updatedAt", "number"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  phase: z.enum(casePhases).optional(),
  clientId: z.string().uuid().optional(),
  area: z.string().optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
