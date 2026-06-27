import { getSupabase } from "../config/supabase";
import { NotFoundError } from "./errors";

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  filters?: Record<string, unknown>;
}

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

export class SupabaseRepository<T extends { id: string }> {
  constructor(
    private table: string,
    private searchColumns: string[] = [],
    private entityName: string = "Registro"
  ) {}

  async findAll(opts: QueryOptions = {}): Promise<PaginatedResult<T>> {
    const db = getSupabase();
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const offset = (page - 1) * limit;
    const sort = opts.sort || "created_at";
    const order = opts.order || "desc";

    let query = db.from(this.table).select("*", { count: "exact" }).is("deleted_at", null);

    if (opts.search && this.searchColumns.length > 0) {
      const orClauses = this.searchColumns.map((col) => `${col}.ilike.%${opts.search}%`).join(",");
      query = query.or(orClauses);
    }

    if (opts.filters) {
      for (const [key, value] of Object.entries(opts.filters)) {
        if (value !== undefined && value !== null && value !== "") {
          query = query.eq(key, value);
        }
      }
    }

    query = query.order(sort, { ascending: order === "asc" }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []) as T[],
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findById(id: string): Promise<T> {
    const db = getSupabase();
    const { data, error } = await db
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error || !data) throw new NotFoundError(this.entityName);
    return data as T;
  }

  async create(input: Partial<T>): Promise<T> {
    const db = getSupabase();
    const { data, error } = await db.from(this.table).insert(input as any).select().single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  async update(id: string, input: Partial<T>): Promise<T> {
    const db = getSupabase();
    const { data, error } = await db
      .from(this.table)
      .update(input as any)
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundError(this.entityName);
    return data as T;
  }

  async softDelete(id: string): Promise<void> {
    const db = getSupabase();
    const { error, count } = await db
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    if (count === 0) throw new NotFoundError(this.entityName);
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    const db = getSupabase();
    let query = db.from(this.table).select("*", { count: "exact", head: true }).is("deleted_at", null);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) query = query.eq(key, value);
      }
    }
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count || 0;
  }

  async aggregate(column: string, fn: "sum" | "count" = "count", filters?: Record<string, unknown>): Promise<number> {
    const db = getSupabase();
    let query = db.from(this.table).select(column).is("deleted_at", null);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) query = query.eq(key, value);
      }
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (fn === "sum") return (data || []).reduce((acc: number, row: any) => acc + (Number(row[column]) || 0), 0);
    return (data || []).length;
  }
}
