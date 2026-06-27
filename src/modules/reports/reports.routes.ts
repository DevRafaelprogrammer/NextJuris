import { paramId } from "../../utils/params";
import { Router, Request, Response } from "express";
import { ReportsService } from "./reports.service";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated, sendNoContent } from "../../utils/response";
import { createReportSchema, updateReportSchema, listReportsQuerySchema, generateReportSchema } from "./reports.schema";
import { z } from "zod";

const router = Router();
const service = new ReportsService();
const idParam = z.object({ id: z.string().uuid() });

router.get("/", validate({ query: listReportsQuerySchema }), asyncHandler(async (req: Request, res: Response) => {
  const result = service.list(req.validatedQuery || req.query as any);
  sendSuccess(res, result);
}));

router.get("/stats", asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, service.getStats());
}));

router.get("/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, service.getById(paramId(req)));
}));

router.post("/", validate({ body: createReportSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, service.create(req.body));
}));

router.post("/generate", validate({ body: generateReportSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, service.generate(req.body));
}));

router.post("/:id/duplicate", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, service.duplicate(paramId(req)));
}));

router.patch("/:id", validate({ params: idParam, body: updateReportSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, service.update(paramId(req), req.body));
}));

router.delete("/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  service.delete(paramId(req));
  sendNoContent(res);
}));

export { router as reportsRoutes };
