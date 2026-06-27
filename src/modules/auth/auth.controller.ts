import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { sendCreated, sendSuccess } from "../../utils/response";
import { RegisterInput, LoginInput } from "./auth.schema";

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body as RegisterInput);
    sendCreated(res, result);
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body as LoginInput);
    sendSuccess(res, result);
  }

  async me(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { user: req.user });
  }
}
