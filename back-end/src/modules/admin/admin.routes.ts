import { Router, Request, Response } from "express";
import { authenticate } from "../../middleware/auth";
import { requireRole, requirePermission, getPermissions, getRoleLevel, type Role } from "../../middleware/roles";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendNoContent } from "../../utils/response";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors";
import { validate } from "../../middleware/validate";
import { getSupabase } from "../../config/supabase";
import { getErrorMetrics } from "../../middleware/error-handler";
import { getDatabaseStatus, getTableStats, isConnected } from "../../config/database";
import { z } from "zod";
import { paramId } from "../../utils/params";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin"));

const idParam = z.object({ id: z.string().uuid() });

const changeRoleSchema = z.object({
  role: z.enum(["admin", "advogado", "socio", "associado", "estagiario", "secretaria", "paralegal", "cliente"]),
});

const bulkActionSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(["activate", "suspend", "deactivate", "delete", "change-role"]),
  role: z.enum(["admin", "advogado", "socio", "associado", "estagiario", "secretaria", "paralegal", "cliente"]).optional(),
});

router.get("/overview", asyncHandler(async (_req: Request, res: Response) => {
  const db = getSupabase();

  const [usersRes, reportsRes, casesRes, eventsRes, financialsRes, loginsRes] = await Promise.all([
    db.from("users").select("role, status, is_verified, last_login_at, created_at").is("deleted_at", null),
    db.from("reports").select("status, generated_by, created_at").is("deleted_at", null),
    db.from("cases").select("phase, estimated_value").is("deleted_at", null),
    db.from("calendar_events").select("type, starts_at, is_completed").is("deleted_at", null),
    db.from("financials").select("type, status, amount").is("deleted_at", null),
    db.from("login_history").select("success, created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  const users = usersRes.data || [];
  const reports = reportsRes.data || [];
  const cases = casesRes.data || [];
  const events = eventsRes.data || [];
  const financials = financialsRes.data || [];
  const logins = loginsRes.data || [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const byRole: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let verified = 0, active7d = 0, active30d = 0, newUsers30d = 0;

  for (const u of users) {
    byRole[u.role] = (byRole[u.role] || 0) + 1;
    byStatus[u.status] = (byStatus[u.status] || 0) + 1;
    if (u.is_verified) verified++;
    if (u.last_login_at && new Date(u.last_login_at) >= sevenDaysAgo) active7d++;
    if (u.last_login_at && new Date(u.last_login_at) >= thirtyDaysAgo) active30d++;
    if (new Date(u.created_at) >= thirtyDaysAgo) newUsers30d++;
  }

  const reportsByStatus: Record<string, number> = {};
  let iaGenerated = 0;
  for (const r of reports) {
    reportsByStatus[r.status] = (reportsByStatus[r.status] || 0) + 1;
    if (r.generated_by === "ia") iaGenerated++;
  }

  const casesByPhase: Record<string, number> = {};
  let totalCaseValue = 0;
  for (const c of cases) {
    casesByPhase[c.phase] = (casesByPhase[c.phase] || 0) + 1;
    totalCaseValue += Number(c.estimated_value) || 0;
  }

  const pendingFinancials = financials
    .filter(f => f.status === "pendente")
    .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  const loginSuccess = logins.filter(l => l.success).length;
  const loginFailed = logins.filter(l => !l.success).length;

  sendSuccess(res, {
    users: {
      total: users.length,
      byRole,
      byStatus,
      verified,
      active7d,
      active30d,
      newUsers30d,
    },
    reports: {
      total: reports.length,
      byStatus: reportsByStatus,
      iaGenerated,
      iaPercentage: reports.length ? Math.round((iaGenerated / reports.length) * 100) : 0,
    },
    cases: {
      total: cases.length,
      byPhase: casesByPhase,
      totalValue: totalCaseValue,
    },
    financials: {
      pendingAmount: pendingFinancials,
      total: financials.length,
    },
    security: {
      recentLogins: logins.length,
      loginSuccess,
      loginFailed,
      failRate: logins.length ? Math.round((loginFailed / logins.length) * 100) : 0,
    },
    system: {
      database: isConnected() ? "connected" : "supabase-only",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    },
    generatedAt: new Date().toISOString(),
  });
}));

router.get("/users", asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  let query = db.from("users")
    .select("id, full_name, email, phone, cpf, oab_number, oab_state, role, status, office_name, area, is_verified, last_login_at, login_count, failed_login_count, locked_until, two_factor_enabled, created_at", { count: "exact" })
    .is("deleted_at", null);

  const search = req.query.search as string;
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,oab_number.ilike.%${search}%`);

  const role = req.query.role as string;
  if (role) query = query.eq("role", role);

  const status = req.query.status as string;
  if (status) query = query.eq("status", status);

  const sort = (req.query.sort as string) || "created_at";
  const order = (req.query.order as string) === "asc";
  query = query.order(sort, { ascending: order }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count || 0;
  sendSuccess(res, {
    data: (data || []).map((u: any) => ({
      ...u,
      permissions: getPermissions(u.role),
      roleLevel: getRoleLevel(u.role),
      isLocked: u.locked_until && new Date(u.locked_until) > new Date(),
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 },
  });
}));

router.get("/users/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const id = paramId(req);

  const [userRes, sessionsRes, loginsRes, reportsRes] = await Promise.all([
    db.from("users").select("*").eq("id", id).is("deleted_at", null).single(),
    db.from("user_sessions").select("id, ip_address, user_agent, created_at, expires_at, revoked_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    db.from("login_history").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("reports").select("id, title, type, status, created_at").eq("created_by", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
  ]);

  if (userRes.error || !userRes.data) throw new NotFoundError("Usuario");

  const { two_factor_secret, ...user } = userRes.data;

  sendSuccess(res, {
    user: {
      ...user,
      permissions: getPermissions(user.role),
      roleLevel: getRoleLevel(user.role),
      isLocked: user.locked_until && new Date(user.locked_until) > new Date(),
    },
    sessions: sessionsRes.data || [],
    loginHistory: loginsRes.data || [],
    recentReports: reportsRes.data || [],
  });
}));

router.patch("/users/:id/role", validate({ params: idParam, body: changeRoleSchema }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const id = paramId(req);
  const { role: newRole } = req.body;

  if (id === req.user!.sub) throw new BadRequestError("Voce nao pode alterar sua propria role.");

  const { data: target } = await db.from("users").select("id, role, full_name").eq("id", id).is("deleted_at", null).single();
  if (!target) throw new NotFoundError("Usuario");

  const callerLevel = getRoleLevel(req.user!.role);
  const targetLevel = getRoleLevel(target.role);
  const newLevel = getRoleLevel(newRole);

  if (targetLevel >= callerLevel) throw new ForbiddenError("Voce nao pode alterar a role de um usuario com nivel igual ou superior.");
  if (newLevel >= callerLevel) throw new ForbiddenError("Voce nao pode promover um usuario para um nivel igual ou superior ao seu.");

  const { data: updated, error } = await db.from("users").update({ role: newRole }).eq("id", id).select().single();
  if (error) throw new Error(error.message);

  const { two_factor_secret, ...safe } = updated;
  sendSuccess(res, { ...safe, permissions: getPermissions(newRole) });
}));

router.post("/users/:id/activate", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const id = paramId(req);
  const { data, error } = await db.from("users")
    .update({ status: "ativo", is_verified: true, verified_at: new Date().toISOString() })
    .eq("id", id).is("deleted_at", null).select().single();
  if (error || !data) throw new NotFoundError("Usuario");
  sendSuccess(res, data);
}));

router.post("/users/:id/suspend", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const id = paramId(req);
  if (id === req.user!.sub) throw new BadRequestError("Voce nao pode suspender sua propria conta.");
  const { data, error } = await db.from("users")
    .update({ status: "suspenso" })
    .eq("id", id).is("deleted_at", null).select().single();
  if (error || !data) throw new NotFoundError("Usuario");

  await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", id).is("revoked_at", null);

  sendSuccess(res, data);
}));

router.post("/users/:id/unlock", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const id = paramId(req);
  const { data, error } = await db.from("users")
    .update({ locked_until: null, failed_login_count: 0 })
    .eq("id", id).is("deleted_at", null).select().single();
  if (error || !data) throw new NotFoundError("Usuario");
  sendSuccess(res, data);
}));

router.post("/users/:id/revoke-sessions", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const id = paramId(req);
  const { data } = await db.from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", id).is("revoked_at", null).select("id");
  sendSuccess(res, { revokedCount: data?.length || 0 });
}));

router.delete("/users/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const id = paramId(req);
  if (id === req.user!.sub) throw new BadRequestError("Voce nao pode excluir sua propria conta.");

  const { data: target } = await db.from("users").select("role").eq("id", id).is("deleted_at", null).single();
  if (!target) throw new NotFoundError("Usuario");
  if (getRoleLevel(target.role as Role) >= getRoleLevel(req.user!.role as Role)) {
    throw new ForbiddenError("Voce nao pode excluir um usuario com nivel igual ou superior.");
  }

  await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", id).is("revoked_at", null);
  await db.from("users").update({ deleted_at: new Date().toISOString(), status: "inativo" }).eq("id", id);
  sendNoContent(res);
}));

router.post("/users/bulk", validate({ body: bulkActionSchema }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const { userIds, action, role } = req.body;

  const selfIncluded = userIds.includes(req.user!.sub);
  if (selfIncluded && ["suspend", "deactivate", "delete"].includes(action)) {
    throw new BadRequestError("Voce nao pode aplicar esta acao na sua propria conta.");
  }

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const id of userIds) {
    try {
      switch (action) {
        case "activate":
          await db.from("users").update({ status: "ativo", is_verified: true, verified_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
          break;
        case "suspend":
          await db.from("users").update({ status: "suspenso" }).eq("id", id).is("deleted_at", null);
          await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", id).is("revoked_at", null);
          break;
        case "deactivate":
          await db.from("users").update({ status: "inativo" }).eq("id", id).is("deleted_at", null);
          break;
        case "delete":
          await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", id).is("revoked_at", null);
          await db.from("users").update({ deleted_at: new Date().toISOString(), status: "inativo" }).eq("id", id);
          break;
        case "change-role":
          if (!role) { results.push({ id, success: false, error: "Role nao informada" }); continue; }
          await db.from("users").update({ role }).eq("id", id).is("deleted_at", null);
          break;
      }
      results.push({ id, success: true });
    } catch (err: any) {
      results.push({ id, success: false, error: err.message });
    }
  }

  sendSuccess(res, {
    action,
    total: userIds.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
}));

router.get("/audit", asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const limit = Math.min(100, Number(req.query.limit) || 50);

  const { data: logins } = await db.from("login_history")
    .select("id, user_id, success, ip_address, user_agent, failure_reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const userIds = [...new Set((logins || []).map((l: any) => l.user_id))];
  const { data: users } = await db.from("users").select("id, full_name, email, role").in("id", userIds);
  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  sendSuccess(res, {
    entries: (logins || []).map((l: any) => ({
      ...l,
      user: userMap[l.user_id] || null,
    })),
    total: logins?.length || 0,
  });
}));

router.get("/system", asyncHandler(async (_req: Request, res: Response) => {
  const [dbStatus, tables, errorMetrics] = await Promise.all([
    getDatabaseStatus(),
    getTableStats().catch(() => ({})),
    Promise.resolve(getErrorMetrics()),
  ]);

  sendSuccess(res, {
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    },
    database: dbStatus,
    tables,
    errors: errorMetrics,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      port: process.env.PORT,
    },
  });
}));

export { router as adminRoutes };
