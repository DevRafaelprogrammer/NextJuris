import { z } from "zod";

export const clientTypes = ["pessoa_fisica", "pessoa_juridica"] as const;

export const createClientSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  type: z.enum(clientTypes),
  document: z.string().min(11).max(18).trim(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  area: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const listClientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "name"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().optional(),
  type: z.enum(clientTypes).optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
