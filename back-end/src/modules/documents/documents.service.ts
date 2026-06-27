import { SupabaseRepository, PaginatedResult } from "../../utils/supabase-repository";
import { getSupabase } from "../../config/supabase";
import { CreateDocumentInput, UpdateDocumentInput } from "./documents.schema";

export interface Document {
  id: string;
  name: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string | null;
  case_id: string | null;
  client_id: string | null;
  report_id: string | null;
  tags: string[];
  description: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

const repo = new SupabaseRepository<Document>("documents", ["name", "description"], "Documento");

export class DocumentsService {
  async list(query: any): Promise<PaginatedResult<Document>> {
    const filters: Record<string, unknown> = {};
    if (query.category) filters.category = query.category;
    if (query.caseId) filters.case_id = query.caseId;
    if (query.clientId) filters.client_id = query.clientId;
    return repo.findAll({
      page: query.page, limit: query.limit,
      sort: query.sort === "name" ? "name" : query.sort === "size" ? "size_bytes" : "created_at",
      order: query.order, search: query.search, filters,
    });
  }

  async getById(id: string): Promise<Document> { return repo.findById(id); }

  async create(input: CreateDocumentInput): Promise<Document> {
    return repo.create({
      name: input.name, category: input.category,
      mime_type: input.mimeType, size_bytes: input.size,
      case_id: input.caseId ?? null, client_id: input.clientId ?? null,
      report_id: input.reportId ?? null,
      tags: input.tags, description: input.description ?? null,
      storage_path: `/documents/${input.name}`,
    } as unknown as Partial<Document>);
  }

  async update(id: string, input: UpdateDocumentInput): Promise<Document> {
    return repo.update(id, input as unknown as Partial<Document>);
  }

  async delete(id: string): Promise<void> { return repo.softDelete(id); }

  async getStats() {
    const db = getSupabase();
    const { data, error } = await db.from("documents").select("category, size_bytes").is("deleted_at", null);
    if (error) throw new Error(error.message);
    const all = data || [];
    const byCategory: Record<string, number> = {};
    let totalSize = 0;
    for (const d of all) { byCategory[d.category] = (byCategory[d.category] || 0) + 1; totalSize += d.size_bytes || 0; }
    return { total: all.length, byCategory, totalSize, totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100 };
  }
}
