import { Request, Response } from "express";
import { sendSuccess } from "../../utils/response";

export class UsersController {
  async list(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { users: [], total: 0 });
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { id: req.params.id, message: "User endpoint ready" });
  }
}
