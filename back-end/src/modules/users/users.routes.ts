import { Router, Request, Response } from "express";
import { paramId } from "../../utils/params";
import { UsersService } from "./users.service";
import { validate } from "../../middleware/validate";
import { requirePermission, requireMinRole } from "../../middleware/roles";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated, sendNoContent } from "../../utils/response";
import { ForbiddenError } from "../../utils/errors";
import {
  createUserSchema,
  updateUserSchema,
  updatePreferencesSchema,
  listUsersQuerySchema,
  userIdParamSchema,
} from "./users.schema";

const router = Router();
const service = new UsersService();

router.get("/", requirePermission("users:read"), validate({ query: listUsersQuerySchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.list(req.validatedQuery || req.query as any));
}));

router.get("/stats", requirePermission("users:read"), asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getStats());
}));

router.get("/me", asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getById(req.user!.sub));
}));

router.get("/email/:email", requirePermission("users:read"), asyncHandler(async (req: Request, res: Response) => {
  const email = Array.isArray(req.params.email) ? req.params.email[0] : req.params.email;
  const user = await service.getByEmail(email);
  if (!user) return sendSuccess(res, null);
  sendSuccess(res, user);
}));

router.get("/:id", requirePermission("users:read"), validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getById(paramId(req)));
}));

router.post("/", requirePermission("users:write"), validate({ body: createUserSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await service.create(req.body));
}));

router.patch("/:id", validate({ params: userIdParamSchema, body: updateUserSchema }), asyncHandler(async (req: Request, res: Response) => {
  const targetId = paramId(req);
  const isSelf = targetId === req.user!.sub;
  if (!isSelf) requirePermission("users:write")(req, res, () => {});
  if (req.body.role && !isSelf) requirePermission("users:manage-roles")(req, res, () => {});
  if (req.body.role && isSelf) throw new ForbiddenError("Voce nao pode alterar sua propria role.");
  sendSuccess(res, await service.update(targetId, req.body));
}));

router.patch("/:id/preferences", validate({ params: userIdParamSchema, body: updatePreferencesSchema }), asyncHandler(async (req: Request, res: Response) => {
  const targetId = paramId(req);
  if (targetId !== req.user!.sub) requirePermission("users:write")(req, res, () => {});
  sendSuccess(res, await service.updatePreferences(targetId, req.body));
}));

router.post("/:id/activate", requirePermission("users:write"), validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.activate(paramId(req)));
}));

router.post("/:id/suspend", requirePermission("users:write"), validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.suspend(paramId(req)));
}));

router.delete("/:id", requirePermission("users:delete"), validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  await service.delete(paramId(req));
  sendNoContent(res);
}));

export { router as usersRoutes };
