import { z } from "zod";

export const docCategories = ["contrato", "peca", "parecer", "modelo", "procuracao", "laudo", "outro"] as const;

export const createDocumentSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  category: z.enum(docCategories),
  mimeType: z.string().max(100).default("application/pdf"),
  size: z.number().int().min(0).default(0),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  reportId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  description: z.string().max(1000).optional(),
});

export const updateDocumentSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  category: z.enum(docCategories).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  description: z.string().max(1000).optional(),
});

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "name", "size"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  category: z.enum(docCategories).optional(),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
