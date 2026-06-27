import { SupabaseRepository, PaginatedResult } from "../../utils/supabase-repository";
import { getSupabase } from "../../config/supabase";
import { ConflictError } from "../../utils/errors";
import { CreateCaseInput, UpdateCaseInput } from "./cases.schema";

export interface Case {
  id: string;
  case_number: string;
  parties: string;
  court: string;
  judge: string | null;
  area: string;
  phase: string;
  client_id: string | null;
  estimated_value: number;
  description: string | null;
  next_deadline: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const repo = new SupabaseRepository<Case>("cases", ["case_number", "parties", "court", "area"], "Processo");

export class CasesService {
  async list(query: any): Promise<PaginatedResult<Case>> {
    const filters: Record<string, unknown> = {};
    if (query.phase) filters.phase = query.phase;
    if (query.clientId) filters.client_id = query.clientId;
    return repo.findAll({
      page: query.page, limit: query.limit,
      sort: query.sort === "number" ? "case_number" : query.sort === "updatedAt" ? "updated_at" : "created_at",
      order: query.order, search: query.search, filters,
    });
  }

  async getById(id: string): Promise<Case> { return repo.findById(id); }

  async create(input: CreateCaseInput): Promise<Case> {
    const db = getSupabase();
    const { data: dup } = await db.from("cases").select("id").eq("case_number", input.number).is("deleted_at", null).maybeSingle();
    if (dup) throw new ConflictError("Processo com este numero ja cadastrado.");
    return repo.create({
      case_number: input.number, parties: input.parties, court: input.court,
      judge: input.judge ?? null, area: input.area, phase: input.phase ?? "conhecimento",
      client_id: input.clientId ?? null, estimated_value: input.value ?? 0,
      description: input.description ?? null,
    } as unknown as Partial<Case>);
  }

  async update(id: string, input: UpdateCaseInput): Promise<Case> {
    const mapped: any = { ...input };
    if (input.number !== undefined) { mapped.case_number = input.number; delete mapped.number; }
    if (input.clientId !== undefined) { mapped.client_id = input.clientId; delete mapped.clientId; }
    if (input.value !== undefined) { mapped.estimated_value = input.value; delete mapped.value; }
    return repo.update(id, mapped);
  }

  async delete(id: string): Promise<void> { return repo.softDelete(id); }

  async getStats() {
    const db = getSupabase();
    const { data, error } = await db.from("cases").select("phase, estimated_value, id, case_number, parties, next_deadline").is("deleted_at", null);
    if (error) throw new Error(error.message);
    const all = data || [];
    const byPhase: Record<string, number> = {};
    let totalValue = 0;
    for (const c of all) { byPhase[c.phase] = (byPhase[c.phase] || 0) + 1; totalValue += Number(c.estimated_value) || 0; }
    const upcoming = all.filter((c) => c.next_deadline && new Date(c.next_deadline) > new Date())
      .sort((a, b) => new Date(a.next_deadline!).getTime() - new Date(b.next_deadline!).getTime()).slice(0, 5);
    return { total: all.length, byPhase, totalValue, upcomingDeadlines: upcoming.map((c) => ({ id: c.id, number: c.case_number, parties: c.parties, deadline: c.next_deadline, phase: c.phase })) };
  }
}
