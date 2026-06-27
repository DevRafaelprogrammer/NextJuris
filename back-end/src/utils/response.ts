import { Response } from "express";
import { StatusCodes } from "http-status-codes";

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    context?: Record<string, unknown>;
    timestamp: string;
    path?: string;
    requestId?: string;
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function sendSuccess<T>(res: Response, data: T, statusCode = StatusCodes.OK): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, StatusCodes.CREATED);
}

export function sendNoContent(res: Response): void {
  res.status(StatusCodes.NO_CONTENT).send();
}

export function sendAccepted<T>(res: Response, data: T): void {
  sendSuccess(res, data, StatusCodes.ACCEPTED);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta
): void {
  const response: ApiSuccessResponse<T[]> = {
    success: true,
    data,
    meta,
    timestamp: new Date().toISOString(),
  };
  res.status(StatusCodes.OK).json(response);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
  context?: Record<string, unknown>
): void {
  const requestId = res.getHeader("X-Request-Id") as string | undefined;

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
      ...(details ? { details } : {}),
      ...(context && Object.keys(context).length > 0 ? { context } : {}),
    },
  };

  if (statusCode === StatusCodes.TOO_MANY_REQUESTS && context?.retryAfter) {
    res.setHeader("Retry-After", String(context.retryAfter));
  }

  if (statusCode === StatusCodes.SERVICE_UNAVAILABLE && context?.retryAfter) {
    res.setHeader("Retry-After", String(context.retryAfter));
  }

  res.status(statusCode).json(response);
}
