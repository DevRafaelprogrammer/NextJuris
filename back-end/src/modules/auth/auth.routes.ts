import { Router, Request, Response } from "express";
import { AuthService } from "./auth.service";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth";
import { requireRole, requirePermission, getPermissions } from "../../middleware/roles";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated, sendNoContent } from "../../utils/response";
import { BadRequestError } from "../../utils/errors";
import { getSupabase } from "../../config/supabase";
import { COOKIE_NAMES, accessTokenCookie, refreshTokenCookie, userDataCookie, clearCookieOpts } from "../../config/cookies";
import {
  registerSchema,
  registerStep1Schema,
  registerStep2Schema,
  registerStep3Schema,
  validateFieldSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from "./auth.schema";

const router = Router();
const service = new AuthService();

function getClientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  return req.socket.remoteAddress || null;
}

function getUserAgent(req: Request): string | null {
  return (req.headers["user-agent"] as string) || null;
}

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string; expiresIn: number }, user: Record<string, unknown>): void {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, accessTokenCookie(tokens.expiresIn * 1000));
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookie());

  const safeUser = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url || null,
    oab_number: user.oab_number || null,
    oab_state: user.oab_state || null,
    permissions: getPermissions(user.role as string),
  };
  res.cookie(COOKIE_NAMES.USER_DATA, JSON.stringify(safeUser), userDataCookie());
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOpts());
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearCookieOpts("/api/auth"));
  res.clearCookie(COOKIE_NAMES.USER_DATA, { path: "/" });
  res.clearCookie(COOKIE_NAMES.SESSION_ID, clearCookieOpts());
  res.clearCookie(COOKIE_NAMES.PREFERENCES, { path: "/" });
}

router.post("/register/validate/step1", validate({ body: registerStep1Schema }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const conflicts: Record<string, string> = {};

  const { data: emailDup } = await db.from("users").select("id").eq("email", req.body.email).is("deleted_at", null).maybeSingle();
  if (emailDup) conflicts.email = "E-mail ja cadastrado.";

  if (req.body.cpf) {
    const { data: cpfDup } = await db.from("users").select("id").eq("cpf", req.body.cpf).is("deleted_at", null).maybeSingle();
    if (cpfDup) conflicts.cpf = "CPF ja cadastrado.";
  }

  if (req.body.phone) {
    const normalized = req.body.phone.replace(/\D/g, "");
    const { data: phoneDup } = await db.from("users").select("id").eq("phone", req.body.phone).is("deleted_at", null).maybeSingle();
    if (phoneDup) conflicts.phone = "Telefone ja cadastrado.";
  }

  sendSuccess(res, {
    valid: Object.keys(conflicts).length === 0,
    conflicts,
    data: { fullName: req.body.fullName, email: req.body.email, cpf: req.body.cpf, phone: req.body.phone },
  });
}));

router.post("/register/validate/step2", validate({ body: registerStep2Schema }), asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const conflicts: Record<string, string> = {};

  if (req.body.oabNumber && req.body.oabState) {
    const { data: oabDup } = await db.from("users").select("id")
      .eq("oab_number", req.body.oabNumber)
      .eq("oab_state", req.body.oabState)
      .is("deleted_at", null).maybeSingle();
    if (oabDup) conflicts.oabNumber = `OAB/${req.body.oabState} ${req.body.oabNumber} ja cadastrada.`;
  }

  if (req.body.officeCnpj) {
    const { data: cnpjDup } = await db.from("users").select("id").eq("office_cnpj", req.body.officeCnpj).is("deleted_at", null).maybeSingle();
    if (cnpjDup) conflicts.officeCnpj = "CNPJ ja cadastrado.";
  }

  sendSuccess(res, {
    valid: Object.keys(conflicts).length === 0,
    conflicts,
    data: req.body,
  });
}));

router.post("/register/validate/step3", validate({ body: registerStep3Schema }), asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, { valid: true });
}));

router.post("/register/validate/field", validate({ body: validateFieldSchema }), asyncHandler(async (req: Request, res: Response) => {
  const { field, value, oabState } = req.body;
  const db = getSupabase();
  let available = true;
  let message = "";

  switch (field) {
    case "email": {
      const { data } = await db.from("users").select("id").eq("email", value.toLowerCase()).is("deleted_at", null).maybeSingle();
      available = !data;
      message = data ? "E-mail ja cadastrado." : "E-mail disponivel.";
      break;
    }
    case "cpf": {
      const normalized = value.replace(/\D/g, "");
      const formatted = normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      const { data } = await db.from("users").select("id").eq("cpf", formatted).is("deleted_at", null).maybeSingle();
      available = !data;
      message = data ? "CPF ja cadastrado." : "CPF disponivel.";
      break;
    }
    case "oabNumber": {
      if (!oabState) { available = true; message = "Informe a seccional."; break; }
      const { data } = await db.from("users").select("id")
        .eq("oab_number", value)
        .eq("oab_state", oabState.toUpperCase())
        .is("deleted_at", null).maybeSingle();
      available = !data;
      message = data ? `OAB/${oabState.toUpperCase()} ${value} ja cadastrada.` : "OAB disponivel.";
      break;
    }
    case "phone": {
      const { data } = await db.from("users").select("id").eq("phone", value).is("deleted_at", null).maybeSingle();
      available = !data;
      message = data ? "Telefone ja cadastrado." : "Telefone disponivel.";
      break;
    }
  }

  sendSuccess(res, { field, available, message });
}));

router.post("/register", validate({ body: registerSchema }), asyncHandler(async (req: Request, res: Response) => {
  const result = await service.register(req.body);
  setAuthCookies(res, result.tokens, result.user);
  sendCreated(res, result);
}));

router.get("/register/areas", asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, {
    areas: [
      { value: "Direito civil", label: "Direito civil", icon: "ti-scale" },
      { value: "Direito penal", label: "Direito penal", icon: "ti-gavel" },
      { value: "Direito trabalhista", label: "Direito trabalhista", icon: "ti-briefcase" },
      { value: "Direito tributario", label: "Direito tributario", icon: "ti-receipt-tax" },
      { value: "Direito empresarial", label: "Direito empresarial", icon: "ti-building" },
      { value: "Direito constitucional", label: "Direito constitucional", icon: "ti-book" },
      { value: "Direito administrativo", label: "Direito administrativo", icon: "ti-building-community" },
      { value: "Direito ambiental", label: "Direito ambiental", icon: "ti-leaf" },
      { value: "Direito do consumidor", label: "Direito do consumidor", icon: "ti-shopping-cart" },
      { value: "Direito imobiliario", label: "Direito imobiliario", icon: "ti-home" },
      { value: "Direito digital", label: "Direito digital", icon: "ti-device-laptop" },
      { value: "Direito previdenciario", label: "Direito previdenciario", icon: "ti-heart" },
      { value: "Direito de familia", label: "Direito de familia", icon: "ti-users" },
      { value: "Direito internacional", label: "Direito internacional", icon: "ti-world" },
    ],
    states: ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"],
    comarcas: [
      "Sao Paulo - SP", "Rio de Janeiro - RJ", "Brasilia - DF", "Belo Horizonte - MG",
      "Curitiba - PR", "Porto Alegre - RS", "Salvador - BA", "Recife - PE",
      "Fortaleza - CE", "Goiania - GO", "Manaus - AM", "Belem - PA",
      "Florianopolis - SC", "Vitoria - ES", "Campinas - SP",
    ],
  });
}));

router.post("/login", validate({ body: loginSchema }), asyncHandler(async (req: Request, res: Response) => {
  const result = await service.login(req.body, getClientIp(req), getUserAgent(req));
  setAuthCookies(res, result.tokens, result.user);
  sendSuccess(res, { ...result, permissions: getPermissions(result.user.role as string) });
}));

router.post("/refresh", asyncHandler(async (req: Request, res: Response) => {
  const token = req.body?.refreshToken || (req as any).signedCookies?.[COOKIE_NAMES.REFRESH_TOKEN];
  if (!token) throw new BadRequestError("Refresh token ausente");
  const tokens = await service.refreshToken(token);
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, accessTokenCookie(tokens.expiresIn * 1000));
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookie());
  sendSuccess(res, tokens);
}));

router.post("/logout", asyncHandler(async (req: Request, res: Response) => {
  const token = req.body?.refreshToken || (req as any).signedCookies?.[COOKIE_NAMES.REFRESH_TOKEN];
  if (token) await service.logout(token);
  clearAuthCookies(res);
  sendSuccess(res, { loggedOut: true });
}));

router.post("/logout-all", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const count = await service.logoutAll(req.user!.sub);
  clearAuthCookies(res);
  sendSuccess(res, { revokedSessions: count });
}));

router.post("/forgot-password", validate({ body: forgotPasswordSchema }), asyncHandler(async (req: Request, res: Response) => {
  const result = await service.forgotPassword(req.body);
  sendSuccess(res, result);
}));

router.post("/reset-password", validate({ body: resetPasswordSchema }), asyncHandler(async (req: Request, res: Response) => {
  const result = await service.resetPassword(req.body);
  sendSuccess(res, result);
}));

router.post("/change-password", authenticate, validate({ body: changePasswordSchema }), asyncHandler(async (req: Request, res: Response) => {
  const result = await service.changePassword(req.user!.sub, req.body);
  sendSuccess(res, result);
}));

router.get("/me", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const db = getSupabase();
  const { data: user } = await db.from("users").select("*").eq("id", req.user!.sub).is("deleted_at", null).maybeSingle();
  if (!user) { sendSuccess(res, null); return; }
  const { two_factor_secret, ...safe } = user;
  sendSuccess(res, { ...safe, permissions: getPermissions(safe.role) });
}));

router.get("/sessions", authenticate, asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getActiveSessions(req.user!.sub));
}));

router.get("/login-history", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  sendSuccess(res, await service.getLoginHistory(req.user!.sub, limit));
}));

router.delete("/sessions/:sessionId", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  await service.revokeSession(sessionId, req.user!.sub);
  sendNoContent(res);
}));

export { router as authRoutes };
