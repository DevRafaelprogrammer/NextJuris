import { SupabaseRepository, PaginatedResult } from "../../utils/supabase-repository";
import { getSupabase } from "../../config/supabase";
import { ConflictError } from "../../utils/errors";
import { CreateClientInput, UpdateClientInput } from "./clients.schema";

export interface Client {
  id: string;
  name: string;
  type: string;
  document: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  area: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const repo = new SupabaseRepository<Client>("clients", ["name", "document", "email", "area"], "Cliente");

export class ClientsService {
  async list(query: any): Promise<PaginatedResult<Client>> {
    return repo.findAll({
      page: query.page,
      limit: query.limit,
      sort: query.sort === "name" ? "name" : "created_at",
      order: query.order,
      search: query.search,
      filters: query.type ? { type: query.type } : {},
    });
  }

  async getById(id: string): Promise<Client> {
    return repo.findById(id);
  }

  async create(input: CreateClientInput): Promise<Client> {
    const db = getSupabase();
    const { data: existing } = await db.from("clients").select("id").eq("document", input.document).is("deleted_at", null).maybeSingle();
    if (existing) throw new ConflictError("Cliente com este documento ja cadastrado.");
    return repo.create(input as unknown as Partial<Client>);
  }

  async update(id: string, input: UpdateClientInput): Promise<Client> {
    if (input.document) {
      const db = getSupabase();
      const { data: dup } = await db.from("clients").select("id").eq("document", input.document).neq("id", id).is("deleted_at", null).maybeSingle();
      if (dup) throw new ConflictError("Documento ja cadastrado em outro cliente.");
    }
    return repo.update(id, input as unknown as Partial<Client>);
  }

  async delete(id: string): Promise<void> {
    return repo.softDelete(id);
  }

  async getStats() {
    const db = getSupabase();
    const { data, error } = await db.from("clients").select("type").is("deleted_at", null);
    if (error) throw new Error(error.message);
    const all = data || [];
    return {
      total: all.length,
      pessoaFisica: all.filter((c) => c.type === "pessoa_fisica").length,
      pessoaJuridica: all.filter((c) => c.type === "pessoa_juridica").length,
    };
  }
}
