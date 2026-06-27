import { SupabaseRepository, PaginatedResult } from "../../utils/supabase-repository";
import { getSupabase } from "../../config/supabase";
import { NotFoundError, ConflictError, BadRequestError } from "../../utils/errors";
import { CreateUserInput, UpdateUserInput, UpdatePreferencesInput, ListUsersQuery } from "./users.schema";

export interface User {
  id: string;
  auth_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  avatar_url: string | null;
  oab_number: string | null;
  oab_state: string | null;
  role: string;
  status: string;
  office_name: string | null;
  office_cnpj: string | null;
  area: string | null;
  comarca: string | null;
  specialties: string[];
  bio: string | null;
  is_verified: boolean;
  verified_at: string | null;
  last_login_at: string | null;
  login_count: number;
  failed_login_count: number;
  locked_until: string | null;
  two_factor_enabled: boolean;
  preferences: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

type SafeUser = Omit<User, "two_factor_secret" | "failed_login_count" | "locked_until" | "metadata">;

const repo = new SupabaseRepository<User>("users", ["full_name", "email", "oab_number", "cpf", "office_name"], "Usuario");

function sanitize(user: User): SafeUser {
  const { two_factor_secret, failed_login_count, locked_until, metadata, ...safe } = user as any;
  return safe;
}

export class UsersService {
  async list(query: ListUsersQuery): Promise<PaginatedResult<SafeUser>> {
    const filters: Record<string, unknown> = {};
    if (query.role) filters.role = query.role;
    if (query.status) filters.status = query.status;

    const sortMap: Record<string, string> = { fullName: "full_name", createdAt: "created_at", lastLoginAt: "last_login_at", loginCount: "login_count" };

    const result = await repo.findAll({
      page: query.page,
      limit: query.limit,
      sort: sortMap[query.sort] || "full_name",
      order: query.order,
      search: query.search,
      filters,
    });

    return { ...result, data: result.data.map(sanitize) };
  }

  async getById(id: string): Promise<SafeUser> {
    return sanitize(await repo.findById(id));
  }

  async getByEmail(email: string): Promise<SafeUser | null> {
    const db = getSupabase();
    const { data } = await db.from("users").select("*").eq("email", email.toLowerCase()).is("deleted_at", null).maybeSingle();
    return data ? sanitize(data as User) : null;
  }

  async create(input: CreateUserInput): Promise<SafeUser> {
    const db = getSupabase();
    const { data: emailDup } = await db.from("users").select("id").eq("email", input.email).is("deleted_at", null).maybeSingle();
    if (emailDup) throw new ConflictError("E-mail ja cadastrado.");

    if (input.cpf) {
      const { data: cpfDup } = await db.from("users").select("id").eq("cpf", input.cpf).is("deleted_at", null).maybeSingle();
      if (cpfDup) throw new ConflictError("CPF ja cadastrado.");
    }

    if (input.oabNumber && input.oabState) {
      const { data: oabDup } = await db.from("users").select("id").eq("oab_number", input.oabNumber).eq("oab_state", input.oabState).is("deleted_at", null).maybeSingle();
      if (oabDup) throw new ConflictError("OAB ja cadastrada.");
    }

    const record = await repo.create({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      cpf: input.cpf ?? null,
      oab_number: input.oabNumber ?? null,
      oab_state: input.oabState ?? null,
      role: input.role,
      status: "pendente",
      office_name: input.officeName ?? null,
      office_cnpj: input.officeCnpj ?? null,
      area: input.area ?? null,
      comarca: input.comarca ?? null,
      specialties: input.specialties,
      bio: input.bio ?? null,
    } as unknown as Partial<User>);

    return sanitize(record);
  }

  async update(id: string, input: UpdateUserInput): Promise<SafeUser> {
    const db = getSupabase();

    if (input.email) {
      const { data: dup } = await db.from("users").select("id").eq("email", input.email).neq("id", id).is("deleted_at", null).maybeSingle();
      if (dup) throw new ConflictError("E-mail ja cadastrado por outro usuario.");
    }
    if (input.cpf) {
      const { data: dup } = await db.from("users").select("id").eq("cpf", input.cpf).neq("id", id).is("deleted_at", null).maybeSingle();
      if (dup) throw new ConflictError("CPF ja cadastrado por outro usuario.");
    }

    const mapped: Record<string, unknown> = {};
    if (input.fullName !== undefined) mapped.full_name = input.fullName;
    if (input.email !== undefined) mapped.email = input.email;
    if (input.phone !== undefined) mapped.phone = input.phone;
    if (input.cpf !== undefined) mapped.cpf = input.cpf;
    if (input.avatarUrl !== undefined) mapped.avatar_url = input.avatarUrl;
    if (input.oabNumber !== undefined) mapped.oab_number = input.oabNumber;
    if (input.oabState !== undefined) mapped.oab_state = input.oabState;
    if (input.role !== undefined) mapped.role = input.role;
    if (input.status !== undefined) mapped.status = input.status;
    if (input.officeName !== undefined) mapped.office_name = input.officeName;
    if (input.officeCnpj !== undefined) mapped.office_cnpj = input.officeCnpj;
    if (input.area !== undefined) mapped.area = input.area;
    if (input.comarca !== undefined) mapped.comarca = input.comarca;
    if (input.specialties !== undefined) mapped.specialties = input.specialties;
    if (input.bio !== undefined) mapped.bio = input.bio;
    if (input.twoFactorEnabled !== undefined) mapped.two_factor_enabled = input.twoFactorEnabled;

    return sanitize(await repo.update(id, mapped as Partial<User>));
  }

  async updatePreferences(id: string, prefs: UpdatePreferencesInput): Promise<SafeUser> {
    const current = await repo.findById(id);
    const merged = { ...(current.preferences as Record<string, unknown>), ...prefs };
    return sanitize(await repo.update(id, { preferences: merged } as unknown as Partial<User>));
  }

  async activate(id: string): Promise<SafeUser> {
    return sanitize(await repo.update(id, { status: "ativo", is_verified: true, verified_at: new Date().toISOString() } as unknown as Partial<User>));
  }

  async suspend(id: string): Promise<SafeUser> {
    return sanitize(await repo.update(id, { status: "suspenso" } as unknown as Partial<User>));
  }

  async delete(id: string): Promise<void> {
    return repo.softDelete(id);
  }

  async getStats() {
    const db = getSupabase();
    const { data, error } = await db.rpc("get_user_stats");
    if (error) throw new Error(error.message);
    return data;
  }

  async registerLogin(id: string, ip?: string): Promise<void> {
    const db = getSupabase();
    await db.rpc("register_login", { user_id: id, ip: ip ?? null });
  }

  async checkLocked(email: string): Promise<{ locked: boolean; lockedUntil: string | null; failedAttempts: number }> {
    const db = getSupabase();
    const { data, error } = await db.rpc("check_user_locked", { user_email: email });
    if (error || !data || data.length === 0) return { locked: false, lockedUntil: null, failedAttempts: 0 };
    const row = data[0];
    return { locked: row.locked, lockedUntil: row.locked_until_ts, failedAttempts: row.failed_attempts };
  }
}
