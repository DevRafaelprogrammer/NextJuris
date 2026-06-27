import { Router } from "express";
import { UsersController } from "./users.controller";
import { validate } from "../../middleware/validate";
import { authenticate, authorize } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import { listUsersQuerySchema, userIdParamSchema } from "./users.schema";

const router = Router();
const controller = new UsersController();

router.use(authenticate);

router.get("/", validate({ query: listUsersQuerySchema }), asyncHandler(controller.list));
router.get("/:id", validate({ params: userIdParamSchema }), asyncHandler(controller.getById));

export { router as usersRoutes };
