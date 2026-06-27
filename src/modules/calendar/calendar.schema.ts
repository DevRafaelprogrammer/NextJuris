import { z } from "zod";

export const eventTypes = ["audiencia", "prazo", "reuniao", "despacho", "pericia", "outro"] as const;

export const createEventSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  type: z.enum(eventTypes),
  date: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  location: z.string().max(300).optional(),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
  reminder: z.boolean().default(true),
});

export const updateEventSchema = createEventSchema.partial();

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.enum(eventTypes).optional(),
  caseId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
