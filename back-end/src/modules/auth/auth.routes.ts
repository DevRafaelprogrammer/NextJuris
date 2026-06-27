import { Router, Request, Response } from "express";
import { AuthService } from "./auth.service";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated, sendNoContent } from "../../utils/response";
import {
  registerSchema,
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

router.post("/register", validate({ body: registerSchema }), asyncHandler(async (req: Request, res: Response) => {
  const result = await service.register(req.body);
  sendCreated(res, result);
}));

router.post("/login", validate({ body: loginSchema }), asyncHandler(async (req: Request, res: Response) => {
  const result = await service.login(req.body, getClientIp(req), getUserAgent(req));
  sendSuccess(res, result);
}));

router.post("/refresh", validate({ body: refreshTokenSchema }), asyncHandler(async (req: Request, res: Response) => {
  const tokens = await service.refreshToken(req.body.refreshToken);
  sendSuccess(res, tokens);
}));

router.post("/logout", asyncHandler(async (req: Request, res: Response) => {
  const token = req.body?.refreshToken;
  if (token) await service.logout(token);
  sendSuccess(res, { loggedOut: true });
}));

router.post("/logout-all", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const count = await service.logoutAll(req.user!.sub);
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
  const db = (await import("../../config/supabase")).getSupabase();
  const { data: user } = await db.from("users").select("*").eq("id", req.user!.sub).is("deleted_at", null).maybeSingle();
  if (!user) { sendSuccess(res, null); return; }
  const { two_factor_secret, ...safe } = user;
  sendSuccess(res, safe);
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
