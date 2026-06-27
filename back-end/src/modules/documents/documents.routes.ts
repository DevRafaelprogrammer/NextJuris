import { paramId } from "../../utils/params";
import { Router, Request, Response } from "express";
import { DocumentsService } from "./documents.service";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated, sendNoContent } from "../../utils/response";
import { createDocumentSchema, updateDocumentSchema, listDocumentsQuerySchema } from "./documents.schema";
import { z } from "zod";

const router = Router();
const service = new DocumentsService();
const idParam = z.object({ id: z.string().uuid() });

router.get("/", validate({ query: listDocumentsQuerySchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.list(req.validatedQuery || req.query));
}));

router.get("/stats", asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getStats());
}));

router.get("/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getById(paramId(req)));
}));

router.post("/", validate({ body: createDocumentSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await service.create(req.body));
}));

router.patch("/:id", validate({ params: idParam, body: updateDocumentSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.update(paramId(req), req.body));
}));

router.delete("/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  await service.delete(paramId(req));
  sendNoContent(res);
}));

export { router as documentsRoutes };
