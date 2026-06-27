import { InMemoryStore } from "../../utils/store";
import { paginate, filterBySearch, PaginatedResult } from "../../utils/pagination";
import { NotFoundError } from "../../utils/errors";
import { CreateEventInput, UpdateEventInput } from "./calendar.schema";

export interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  date: Date;
  endDate: Date | null;
  location: string;
  caseId: string | null;
  clientId: string | null;
  description: string;
  priority: string;
  reminder: boolean;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const store = new InMemoryStore<CalendarEvent>();

[
  { title: "Audiencia de instrucao — Silva vs. Banco Central", type: "audiencia", date: new Date("2026-06-28T14:00:00"), location: "3a Vara Civel · Forum Joao Mendes", priority: "urgente", completed: false },
  { title: "Prazo final — Recurso ordinario Proc. 0007891", type: "prazo", date: new Date("2026-06-30T23:59:00"), location: "", priority: "urgente", completed: false },
  { title: "Reuniao com Construtora Beta", type: "reuniao", date: new Date("2026-07-04T10:00:00"), location: "Escritorio sede", priority: "media", completed: false },
  { title: "Despacho — Proc. 0001234", type: "despacho", date: new Date("2026-07-08T09:00:00"), location: "3a Vara Civel - SP", priority: "media", completed: false },
  { title: "Pericia contabil — Banco Beta", type: "pericia", date: new Date("2026-07-15T14:00:00"), location: "Escritorio do perito", priority: "alta", completed: false },
].forEach((e) => store.create({ ...e, endDate: null, caseId: null, clientId: null, description: "", reminder: true } as Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">));

export class CalendarService {
  list(query: any): PaginatedResult<CalendarEvent> {
    let items = store.findAll();
    if (query.search) items = filterBySearch(items, query.search, ["title", "location"]);
    if (query.type) items = items.filter((e) => e.type === query.type);
    if (query.caseId) items = items.filter((e) => e.caseId === query.caseId);
    if (query.from) items = items.filter((e) => e.date >= new Date(query.from));
    if (query.to) items = items.filter((e) => e.date <= new Date(query.to));
    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    return paginate(items, query);
  }

  getById(id: string): CalendarEvent {
    const ev = store.findById(id);
    if (!ev) throw new NotFoundError("Evento");
    return ev;
  }

  create(input: CreateEventInput): CalendarEvent {
    return store.create({ ...input, endDate: input.endDate ?? null, location: input.location ?? "", caseId: input.caseId ?? null, clientId: input.clientId ?? null, description: input.description ?? "", completed: false } as Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">);
  }

  update(id: string, input: UpdateEventInput): CalendarEvent {
    if (!store.findById(id)) throw new NotFoundError("Evento");
    return store.update(id, input as Partial<CalendarEvent>)!;
  }

  complete(id: string): CalendarEvent {
    if (!store.findById(id)) throw new NotFoundError("Evento");
    return store.update(id, { completed: true } as Partial<CalendarEvent>)!;
  }

  delete(id: string): void {
    if (!store.findById(id)) throw new NotFoundError("Evento");
    store.delete(id);
  }

  getUpcoming(days = 30): CalendarEvent[] {
    const now = new Date();
    const limit = new Date(now.getTime() + days * 86400000);
    return store.findWhere((e) => !e.completed && e.date >= now && e.date <= limit).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  getOverdue(): CalendarEvent[] {
    const now = new Date();
    return store.findWhere((e) => !e.completed && e.date < now).sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}
