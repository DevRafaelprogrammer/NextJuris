import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginate<T>(items: T[], query: PaginationQuery): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / query.limit);
  const start = (query.page - 1) * query.limit;
  const data = items.slice(start, start + query.limit);

  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNext: query.page < totalPages,
      hasPrev: query.page > 1,
    },
  };
}

export function sortBy<T>(items: T[], field: keyof T, order: "asc" | "desc" = "desc"): T[] {
  return [...items].sort((a, b) => {
    const va = a[field];
    const vb = b[field];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return order === "asc" ? cmp : -cmp;
  });
}

export function filterBySearch<T>(items: T[], search: string, fields: (keyof T)[]): T[] {
  const q = search.toLowerCase();
  return items.filter((item) =>
    fields.some((f) => String(item[f] ?? "").toLowerCase().includes(q))
  );
}
