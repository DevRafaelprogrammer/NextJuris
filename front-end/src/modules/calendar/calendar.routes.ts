import { paramId } from "../../utils/params";
import { Router, Request, Response } from "express";
import { CalendarService } from "./calendar.service";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated, sendNoContent } from "../../utils/response";
import { createEventSchema, updateEventSchema, listEventsQuerySchema } from "./calendar.schema";
import { z } from "zod";

const router = Router();
const service = new CalendarService();
const idParam = z.object({ id: z.string().uuid() });

router.get("/", validate({ query: listEventsQuerySchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, service.list(req.validatedQuery || req.query));
}));

router.get("/upcoming", asyncHandler(async (req: Request, res: Response) => {
  const days = req.query.days ? Number(req.query.days) : 30;
  sendSuccess(res, service.getUpcoming(days));
}));

router.get("/overdue", asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, service.getOverdue());
}));

router.get("/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, service.getById(paramId(req)));
}));

router.post("/", validate({ body: createEventSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, service.create(req.body));
}));

router.patch("/:id", validate({ params: idParam, body: updateEventSchema }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, service.update(paramId(req), req.body));
}));

router.post("/:id/complete", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, service.complete(paramId(req)));
}));

router.delete("/:id", validate({ params: idParam }), asyncHandler(async (req: Request, res: Response) => {
  service.delete(paramId(req));
  sendNoContent(res);
}));

export { router as calendarRoutes };
