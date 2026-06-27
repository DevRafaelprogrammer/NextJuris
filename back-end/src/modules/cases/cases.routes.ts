import { paramId } from "../../utils/params";
import { Router, Request, Response } from "express";
import { CasesService } from "./cases.service";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated, sendNoContent } from "../../utils/response";
import { createCaseSchema, updateCaseSchema, listCasesQuerySchema } from "./cases.schema";
import { z } from "zod";

const router = Router();
const service = new CasesService();
const idParam = z.object({ id: z.string().uuid() });

router.get("/", validate({ query: listCasesQuerySchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.list(req.validatedQuery || req.query));
}));

router.get("/stats", asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getStats());
}));

router.get("/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getById(paramId(req)));
}));

router.post("/", validate({ body: createCaseSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await service.create(req.body));
}));

router.patch("/:id", validate({ params: idParam, body: updateCaseSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.update(paramId(req), req.body));
}));

router.delete("/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  await service.delete(paramId(req));
  sendNoContent(res);
}));

export { router as casesRoutes };
