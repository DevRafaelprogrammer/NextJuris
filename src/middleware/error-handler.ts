import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { sendError } from "../utils/response";
import { logger } from "../utils/logger";
import { env } from "../config/env";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, StatusCodes.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed", err.message);
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    sendError(res, StatusCodes.BAD_REQUEST, "INVALID_JSON", "Invalid JSON in request body");
    return;
  }

  logger.error("Unhandled error", {
    message: err.message,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });

  sendError(
    res,
    StatusCodes.INTERNAL_SERVER_ERROR,
    "INTERNAL_ERROR",
    env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message
  );
}
