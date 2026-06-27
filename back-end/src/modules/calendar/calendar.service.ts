import { SupabaseRepository, PaginatedResult } from "../../utils/supabase-repository";
import { getSupabase } from "../../config/supabase";
import { CreateEventInput, UpdateEventInput } from "./calendar.schema";

export interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  case_id: string | null;
  client_id: string | null;
  description: string | null;
  priority: string;
  is_completed: boolean;
  completed_at: string | null;
  reminder_minutes: number;
  created_at: string;
  updated_at: string;
}

const repo = new SupabaseRepository<CalendarEvent>("calendar_events", ["title", "location"], "Evento");

export class CalendarService {
  async list(query: any): Promise<PaginatedResult<CalendarEvent>> {
    const db = getSupabase();
    let q = db.from("calendar_events").select("*", { count: "exact" }).is("deleted_at", null);
    if (query.search) q = q.or(`title.ilike.%${query.search}%,location.ilike.%${query.search}%`);
    if (query.type) q = q.eq("type", query.type);
    if (query.caseId) q = q.eq("case_id", query.caseId);
    if (query.from) q = q.gte("starts_at", query.from);
    if (query.to) q = q.lte("starts_at", query.to);
    const page = query.page || 1;
    const limit = query.limit || 50;
    q = q.order("starts_at", { ascending: true }).range((page - 1) * limit, page * limit - 1);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    const total = count || 0;
    return { data: (data || []) as CalendarEvent[], meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 } };
  }

  async getById(id: string): Promise<CalendarEvent> { return repo.findById(id); }

  async create(input: CreateEventInput): Promise<CalendarEvent> {
    return repo.create({
      title: input.title, type: input.type,
      starts_at: input.date.toISOString(),
      ends_at: input.endDate?.toISOString() ?? null,
      location: input.location ?? null,
      case_id: input.caseId ?? null, client_id: input.clientId ?? null,
      description: input.description ?? null,
      priority: input.priority, reminder_minutes: input.reminder ? 60 : 0,
    } as unknown as Partial<CalendarEvent>);
  }

  async update(id: string, input: UpdateEventInput): Promise<CalendarEvent> {
    const mapped: any = {};
    if (input.title !== undefined) mapped.title = input.title;
    if (input.type !== undefined) mapped.type = input.type;
    if (input.date !== undefined) mapped.starts_at = input.date.toISOString();
    if (input.endDate !== undefined) mapped.ends_at = input.endDate?.toISOString() ?? null;
    if (input.location !== undefined) mapped.location = input.location;
    if (input.caseId !== undefined) mapped.case_id = input.caseId;
    if (input.clientId !== undefined) mapped.client_id = input.clientId;
    if (input.description !== undefined) mapped.description = input.description;
    if (input.priority !== undefined) mapped.priority = input.priority;
    return repo.update(id, mapped);
  }

  async complete(id: string): Promise<CalendarEvent> {
    return repo.update(id, { is_completed: true, completed_at: new Date().toISOString() } as unknown as Partial<CalendarEvent>);
  }

  async delete(id: string): Promise<void> { return repo.softDelete(id); }

  async getUpcoming(days = 30): Promise<CalendarEvent[]> {
    const db = getSupabase();
    const now = new Date().toISOString();
    const limit = new Date(Date.now() + days * 86400000).toISOString();
    const { data, error } = await db.from("calendar_events").select("*")
      .is("deleted_at", null).eq("is_completed", false)
      .gte("starts_at", now).lte("starts_at", limit)
      .order("starts_at", { ascending: true }).limit(20);
    if (error) throw new Error(error.message);
    return (data || []) as CalendarEvent[];
  }

  async getOverdue(): Promise<CalendarEvent[]> {
    const db = getSupabase();
    const { data, error } = await db.from("calendar_events").select("*")
      .is("deleted_at", null).eq("is_completed", false)
      .lt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false }).limit(10);
    if (error) throw new Error(error.message);
    return (data || []) as CalendarEvent[];
  }
}
