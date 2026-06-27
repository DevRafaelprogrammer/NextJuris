import { Router, Request, Response } from "express";
import { paramId } from "../../utils/params";
import { UsersService } from "./users.service";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated, sendNoContent } from "../../utils/response";
import {
  createUserSchema,
  updateUserSchema,
  updatePreferencesSchema,
  listUsersQuerySchema,
  userIdParamSchema,
} from "./users.schema";

const router = Router();
const service = new UsersService();

router.get("/", validate({ query: listUsersQuerySchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.list(req.validatedQuery || req.query as any));
}));

router.get("/stats", asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getStats());
}));

router.get("/email/:email", asyncHandler(async (req: Request, res: Response) => {
  const email = Array.isArray(req.params.email) ? req.params.email[0] : req.params.email;
  const user = await service.getByEmail(email);
  if (!user) return sendSuccess(res, null);
  sendSuccess(res, user);
}));

router.get("/:id", validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getById(paramId(req)));
}));

router.post("/", validate({ body: createUserSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await service.create(req.body));
}));

router.patch("/:id", validate({ params: userIdParamSchema, body: updateUserSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.update(paramId(req), req.body));
}));

router.patch("/:id/preferences", validate({ params: userIdParamSchema, body: updatePreferencesSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.updatePreferences(paramId(req), req.body));
}));

router.post("/:id/activate", validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.activate(paramId(req)));
}));

router.post("/:id/suspend", validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.suspend(paramId(req)));
}));

router.delete("/:id", validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  await service.delete(paramId(req));
  sendNoContent(res);
}));

router.post("/:id/login", validate({ params: userIdParamSchema }), asyncHandler(async (req: Request, res: Response) => {
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress;
  await service.registerLogin(paramId(req), ip);
  sendSuccess(res, { registered: true });
}));

router.get("/check-lock/:email", asyncHandler(async (req: Request, res: Response) => {
  const email = Array.isArray(req.params.email) ? req.params.email[0] : req.params.email;
  sendSuccess(res, await service.checkLocked(email));
}));

export { router as usersRoutes };
