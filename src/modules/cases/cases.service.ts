import { InMemoryStore } from "../../utils/store";
import { paginate, sortBy, filterBySearch, PaginatedResult } from "../../utils/pagination";
import { NotFoundError, ConflictError } from "../../utils/errors";
import { CreateCaseInput, UpdateCaseInput } from "./cases.schema";

export interface Case {
  id: string;
  number: string;
  parties: string;
  court: string;
  judge: string;
  area: string;
  phase: string;
  clientId: string | null;
  value: number;
  description: string;
  reportsCount: number;
  nextDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const store = new InMemoryStore<Case>();

[
  { number: "0001234-56.2026.8.26", parties: "Oliveira vs. Silva Ltda.", court: "3a Vara Civel - SP", judge: "Dr. Antonio Pereira", area: "Direito civil", phase: "instrucao", value: 150000, reportsCount: 4, nextDeadline: new Date("2026-06-28T14:00:00") },
  { number: "0007891-23.2025.8.26", parties: "Banco Central vs. Oliveira", court: "12a Vara Federal - SP", judge: "Dra. Maria Santos", area: "Direito civil", phase: "recurso", value: 500000, reportsCount: 8, nextDeadline: new Date("2026-06-30") },
  { number: "0004567-89.2026.8.26", parties: "Souza vs. Construtora Beta", court: "7a Vara Trabalho - SP", judge: "Dr. Carlos Lima", area: "Direito trabalhista", phase: "conciliacao", value: 80000, reportsCount: 3, nextDeadline: new Date("2026-07-04T10:00:00") },
].forEach((c) => store.create({ ...c, clientId: null, description: "" } as Omit<Case, "id" | "createdAt" | "updatedAt">));

export class CasesService {
  list(query: any): PaginatedResult<Case> {
    let items = store.findAll();
    if (query.search) items = filterBySearch(items, query.search, ["number", "parties", "court", "area"]);
    if (query.phase) items = items.filter((c) => c.phase === query.phase);
    if (query.clientId) items = items.filter((c) => c.clientId === query.clientId);
    if (query.area) items = items.filter((c) => c.area.toLowerCase().includes(query.area.toLowerCase()));
    items = sortBy(items, query.sort as keyof Case, query.order);
    return paginate(items, query);
  }

  getById(id: string): Case {
    const c = store.findById(id);
    if (!c) throw new NotFoundError("Processo");
    return c;
  }

  create(input: CreateCaseInput): Case {
    const dup = store.findWhere((c) => c.number === input.number);
    if (dup.length > 0) throw new ConflictError("Processo com este numero ja cadastrado.");
    return store.create({ ...input, clientId: input.clientId ?? null, judge: input.judge ?? "", value: input.value ?? 0, description: input.description ?? "", reportsCount: 0, nextDeadline: null } as Omit<Case, "id" | "createdAt" | "updatedAt">);
  }

  update(id: string, input: UpdateCaseInput): Case {
    if (!store.findById(id)) throw new NotFoundError("Processo");
    return store.update(id, input as Partial<Case>)!;
  }

  delete(id: string): void {
    if (!store.findById(id)) throw new NotFoundError("Processo");
    store.delete(id);
  }

  getStats() {
    const all = store.findAll();
    const byPhase: Record<string, number> = {};
    let totalValue = 0;
    for (const c of all) {
      byPhase[c.phase] = (byPhase[c.phase] || 0) + 1;
      totalValue += c.value;
    }
    const upcoming = all.filter((c) => c.nextDeadline && c.nextDeadline > new Date()).sort((a, b) => (a.nextDeadline!.getTime() - b.nextDeadline!.getTime())).slice(0, 5);
    return { total: all.length, byPhase, totalValue, upcomingDeadlines: upcoming.map((c) => ({ id: c.id, number: c.number, parties: c.parties, deadline: c.nextDeadline, phase: c.phase })) };
  }
}
