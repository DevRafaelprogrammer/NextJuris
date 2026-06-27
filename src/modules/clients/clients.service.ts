import { InMemoryStore } from "../../utils/store";
import { paginate, sortBy, filterBySearch, PaginatedResult } from "../../utils/pagination";
import { NotFoundError, ConflictError } from "../../utils/errors";
import { CreateClientInput, UpdateClientInput } from "./clients.schema";

export interface Client {
  id: string;
  name: string;
  type: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  area: string;
  notes: string;
  activeCases: number;
  totalReports: number;
  createdAt: Date;
  updatedAt: Date;
}

const store = new InMemoryStore<Client>();

[
  { name: "Silva Ltda.", type: "pessoa_juridica", document: "12.345.678/0001-99", email: "contato@silvaltda.com.br", phone: "(11) 3456-7890", area: "Direito civil", activeCases: 3, totalReports: 12 },
  { name: "Maria Costa", type: "pessoa_fisica", document: "123.456.789-00", email: "maria.costa@email.com", phone: "(11) 99876-5432", area: "Direito trabalhista", activeCases: 1, totalReports: 4 },
  { name: "Banco Beta S.A.", type: "pessoa_juridica", document: "98.765.432/0001-10", email: "juridico@bancobeta.com.br", phone: "(11) 2345-6789", area: "Direito empresarial", activeCases: 5, totalReports: 28 },
  { name: "Carlos Souza", type: "pessoa_fisica", document: "987.654.321-00", email: "carlos.souza@email.com", phone: "(11) 98765-4321", area: "Direito civil", activeCases: 2, totalReports: 6 },
].forEach((c) => store.create({ ...c, address: "", notes: "" } as Omit<Client, "id" | "createdAt" | "updatedAt">));

export class ClientsService {
  list(query: any): PaginatedResult<Client> {
    let items = store.findAll();
    if (query.search) items = filterBySearch(items, query.search, ["name", "document", "email", "area"]);
    if (query.type) items = items.filter((c) => c.type === query.type);
    items = sortBy(items, query.sort as keyof Client, query.order);
    return paginate(items, query);
  }

  getById(id: string): Client {
    const client = store.findById(id);
    if (!client) throw new NotFoundError("Cliente");
    return client;
  }

  create(input: CreateClientInput): Client {
    const existing = store.findWhere((c) => c.document === input.document);
    if (existing.length > 0) throw new ConflictError("Cliente com este documento ja cadastrado.");
    return store.create({ ...input, email: input.email ?? "", phone: input.phone ?? "", address: input.address ?? "", area: input.area ?? "", notes: input.notes ?? "", activeCases: 0, totalReports: 0 } as Omit<Client, "id" | "createdAt" | "updatedAt">);
  }

  update(id: string, input: UpdateClientInput): Client {
    if (!store.findById(id)) throw new NotFoundError("Cliente");
    if (input.document) {
      const dup = store.findWhere((c) => c.document === input.document && c.id !== id);
      if (dup.length > 0) throw new ConflictError("Documento ja cadastrado em outro cliente.");
    }
    return store.update(id, input as Partial<Client>)!;
  }

  delete(id: string): void {
    if (!store.findById(id)) throw new NotFoundError("Cliente");
    store.delete(id);
  }

  getStats() {
    const all = store.findAll();
    return {
      total: all.length,
      pessoaFisica: all.filter((c) => c.type === "pessoa_fisica").length,
      pessoaJuridica: all.filter((c) => c.type === "pessoa_juridica").length,
      totalActiveCases: all.reduce((sum, c) => sum + c.activeCases, 0),
    };
  }
}
