import { SupabaseRepository, PaginatedResult } from "../../utils/supabase-repository";
import { getSupabase } from "../../config/supabase";
import { NotFoundError } from "../../utils/errors";
import { CreateReportInput, UpdateReportInput, ListReportsQuery, GenerateReportInput } from "./reports.schema";

export interface Report {
  id: string;
  title: string;
  type: string;
  status: string;
  client_id: string | null;
  case_id: string | null;
  area: string | null;
  description: string | null;
  content: string;
  tags: string[];
  priority: string;
  word_count: number;
  generated_by: string;
  generation_params: Record<string, unknown> | null;
  generation_time_ms: number | null;
  created_at: string;
  updated_at: string;
}

const repo = new SupabaseRepository<Report>("reports", ["title", "description", "area"], "Relatorio");

export class ReportsService {
  async list(query: ListReportsQuery): Promise<PaginatedResult<Report>> {
    const filters: Record<string, unknown> = {};
    if (query.type) filters.type = query.type;
    if (query.status) filters.status = query.status;
    if (query.clientId) filters.client_id = query.clientId;
    if (query.caseId) filters.case_id = query.caseId;
    if (query.priority) filters.priority = query.priority;
    return repo.findAll({
      page: query.page, limit: query.limit,
      sort: query.sort === "updatedAt" ? "updated_at" : query.sort === "title" ? "title" : "created_at",
      order: query.order, search: query.search, filters,
    });
  }

  async getById(id: string): Promise<Report> { return repo.findById(id); }

  async create(input: CreateReportInput): Promise<Report> {
    return repo.create({
      title: input.title, type: input.type, status: "rascunho",
      client_id: input.clientId ?? null, case_id: input.caseId ?? null,
      area: input.area ?? null, description: input.description ?? null,
      content: "", tags: input.tags, priority: input.priority, generated_by: "manual",
    } as unknown as Partial<Report>);
  }

  async update(id: string, input: UpdateReportInput): Promise<Report> {
    const mapped: any = { ...input };
    if (input.clientId !== undefined) { mapped.client_id = input.clientId; delete mapped.clientId; }
    if (input.caseId !== undefined) { mapped.case_id = input.caseId; delete mapped.caseId; }
    return repo.update(id, mapped);
  }

  async delete(id: string): Promise<void> { return repo.softDelete(id); }

  async generate(input: GenerateReportInput): Promise<Report> {
    const startTime = Date.now();
    const content = `PARECER JURÍDICO\n\nI. DOS FATOS\n\n${input.context}\n\nII. DO DIREITO\n\nConforme a legislacao vigente e a jurisprudencia consolidada dos tribunais superiores, verifica-se que a questao apresentada encontra respaldo no ordenamento juridico brasileiro.\n\nIII. DA CONCLUSAO\n\nDiante do exposto, opina-se pela viabilidade da medida pleiteada, nos termos da fundamentacao acima expendida.\n\n${input.area} · Gerado por IA NextJuris`;
    const elapsed = Date.now() - startTime;
    return repo.create({
      title: `${input.type.charAt(0).toUpperCase() + input.type.slice(1)} — ${input.area}`,
      type: input.type, status: "revisao",
      client_id: input.clientId ?? null, case_id: input.caseId ?? null,
      area: input.area, description: `Gerado automaticamente. Tom: ${input.tone}.`,
      content, tags: [input.area.toLowerCase(), "ia", input.type],
      priority: "media", generated_by: "ia",
      generation_params: input as unknown as Record<string, unknown>,
      generation_time_ms: elapsed,
    } as unknown as Partial<Report>);
  }

  async duplicate(id: string): Promise<Report> {
    const original = await this.getById(id);
    return repo.create({
      title: `${original.title} (copia)`, type: original.type, status: "rascunho",
      client_id: original.client_id, case_id: original.case_id,
      area: original.area, description: original.description,
      content: original.content, tags: original.tags,
      priority: original.priority, generated_by: "manual",
    } as unknown as Partial<Report>);
  }

  async getStats() {
    const db = getSupabase();
    const { data, error } = await db.from("reports").select("status, type, word_count, generated_by").is("deleted_at", null);
    if (error) throw new Error(error.message);
    const all = data || [];
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalWords = 0, iaGenerated = 0;
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byType[r.type] = (byType[r.type] || 0) + 1;
      totalWords += r.word_count || 0;
      if (r.generated_by === "ia") iaGenerated++;
    }
    return { total: all.length, byStatus, byType, totalWords, iaGenerated, iaPercentage: all.length ? Math.round((iaGenerated / all.length) * 100) : 0 };
  }
}
