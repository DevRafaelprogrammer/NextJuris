import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import { registerSchema, loginSchema } from "./auth.schema";

const router = Router();
const controller = new AuthController();

router.post("/register", validate({ body: registerSchema }), asyncHandler(controller.register));
router.post("/login", validate({ body: loginSchema }), asyncHandler(controller.login));
router.get("/me", authenticate, asyncHandler(controller.me));

export { router as authRoutes };
