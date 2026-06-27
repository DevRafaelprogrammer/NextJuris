import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { AppError, isOperationalError } from "../utils/errors";
import { sendError } from "../utils/response";
import { logger } from "../utils/logger";
import { env } from "../config/env";

const errorMetrics = {
  total: 0,
  byCode: {} as Record<string, number>,
  byStatus: {} as Record<number, number>,
  last50: [] as Array<{ code: string; message: string; path: string; timestamp: string }>,
};

function recordMetric(code: string, status: number, message: string, path: string): void {
  errorMetrics.total++;
  errorMetrics.byCode[code] = (errorMetrics.byCode[code] || 0) + 1;
  errorMetrics.byStatus[status] = (errorMetrics.byStatus[status] || 0) + 1;
  errorMetrics.last50.push({ code, message, path, timestamp: new Date().toISOString() });
  if (errorMetrics.last50.length > 50) errorMetrics.last50.shift();
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/password["\s:=]+["']?[^"'\s,}]*/gi, "password=***")
    .replace(/token["\s:=]+["']?[^"'\s,}]*/gi, "token=***")
    .replace(/secret["\s:=]+["']?[^"'\s,}]*/gi, "secret=***")
    .replace(/authorization["\s:=]+["']?[^"'\s,}]*/gi, "authorization=***")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "***@***.***");
}

function parseZodErrors(err: ZodError): Array<{ field: string; message: string; code: string }> {
  try {
    const issues = typeof err.message === "string" ? JSON.parse(err.message) : err.issues || [];
    return issues.map((issue: any) => ({
      field: (issue.path || []).join(".") || "unknown",
      message: issue.message || "Valor invalido",
      code: issue.code || "invalid",
    }));
  } catch {
    return [{ field: "unknown", message: err.message, code: "validation_error" }];
  }
}

function extractPgCode(err: any): { code: string; message: string; status: number } | null {
  const pgCode = err.code;
  if (typeof pgCode !== "string" || pgCode.length < 2) return null;

  const pgMap: Record<string, { code: string; message: string; status: number }> = {
    "23505": { code: "DUPLICATE_ENTRY", message: "Registro duplicado", status: 409 },
    "23503": { code: "FOREIGN_KEY_VIOLATION", message: "Referencia invalida — registro vinculado nao existe", status: 400 },
    "23502": { code: "NOT_NULL_VIOLATION", message: "Campo obrigatorio nao preenchido", status: 400 },
    "23514": { code: "CHECK_VIOLATION", message: "Valor fora das restricoes permitidas", status: 400 },
    "42P01": { code: "TABLE_NOT_FOUND", message: "Tabela nao encontrada", status: 500 },
    "42703": { code: "COLUMN_NOT_FOUND", message: "Coluna nao encontrada", status: 500 },
    "57014": { code: "QUERY_TIMEOUT", message: "Consulta excedeu o tempo limite", status: 504 },
    "53300": { code: "TOO_MANY_CONNECTIONS", message: "Muitas conexoes com o banco de dados", status: 503 },
    "08006": { code: "DATABASE_UNREACHABLE", message: "Banco de dados inacessivel", status: 503 },
    "08001": { code: "DATABASE_CONNECTION_FAILED", message: "Falha na conexao com banco de dados", status: 503 },
  };

  return pgMap[pgCode] || null;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const path = req.originalUrl || req.url;

  if (err instanceof AppError) {
    recordMetric(err.code, err.statusCode, err.message, path);

    if (err.statusCode >= 500) {
      logger.error(`[${err.code}] ${err.message}`, {
        statusCode: err.statusCode,
        path,
        context: err.context,
        stack: env.NODE_ENV === "development" ? err.stack : undefined,
      });
    } else {
      logger.warn(`[${err.code}] ${err.message}`, { statusCode: err.statusCode, path });
    }

    sendError(res, err.statusCode, err.code, err.message, err.details, err.context);
    return;
  }

  if (err instanceof ZodError) {
    const fields = parseZodErrors(err);
    recordMetric("VALIDATION_ERROR", 422, "Validation failed", path);
    logger.warn("[VALIDATION_ERROR]", { path, fields: fields.slice(0, 5) });
    sendError(res, StatusCodes.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Erro de validacao", fields);
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    recordMetric("INVALID_JSON", 400, "Invalid JSON", path);
    sendError(res, StatusCodes.BAD_REQUEST, "INVALID_JSON", "JSON invalido no corpo da requisicao");
    return;
  }

  if ((err as any).type === "entity.too.large") {
    recordMetric("PAYLOAD_TOO_LARGE", 413, "Payload too large", path);
    sendError(res, StatusCodes.REQUEST_TOO_LONG, "PAYLOAD_TOO_LARGE", "Payload excede o limite de 10MB");
    return;
  }

  const pgError = extractPgCode(err);
  if (pgError) {
    recordMetric(pgError.code, pgError.status, pgError.message, path);
    logger.error(`[${pgError.code}] ${err.message}`, { pgCode: (err as any).code, path });

    const detail = (err as any).detail;
    const constraint = (err as any).constraint;
    sendError(res, pgError.status, pgError.code, pgError.message, undefined, {
      ...(detail && env.NODE_ENV !== "production" && { detail }),
      ...(constraint && { constraint }),
    });
    return;
  }

  if (err.message?.includes("row-level security")) {
    recordMetric("RLS_VIOLATION", 403, "RLS violation", path);
    logger.error("[RLS_VIOLATION]", { path, message: err.message });
    sendError(res, StatusCodes.FORBIDDEN, "RLS_VIOLATION", "Operacao nao permitida pelas politicas de seguranca");
    return;
  }

  if (err.message?.includes("ECONNREFUSED") || err.message?.includes("ENOTFOUND")) {
    recordMetric("DATABASE_UNREACHABLE", 503, "DB unreachable", path);
    logger.error("[DATABASE_UNREACHABLE]", { message: err.message, path });
    sendError(res, StatusCodes.SERVICE_UNAVAILABLE, "DATABASE_UNREACHABLE", "Servico de banco de dados indisponivel", undefined, { retryAfter: 30 });
    return;
  }

  if (err.message?.includes("timeout") || err.message?.includes("Timeout")) {
    recordMetric("REQUEST_TIMEOUT", 504, "Timeout", path);
    logger.error("[REQUEST_TIMEOUT]", { message: err.message, path });
    sendError(res, StatusCodes.GATEWAY_TIMEOUT, "REQUEST_TIMEOUT", "Requisicao excedeu o tempo limite");
    return;
  }

  recordMetric("INTERNAL_ERROR", 500, err.message, path);

  logger.error("Unhandled error", {
    message: sanitizeMessage(err.message),
    name: err.name,
    path,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });

  sendError(
    res,
    StatusCodes.INTERNAL_SERVER_ERROR,
    "INTERNAL_ERROR",
    env.NODE_ENV === "production" ? "Erro interno do servidor" : sanitizeMessage(err.message)
  );
}

export function getErrorMetrics() {
  return {
    total: errorMetrics.total,
    byCode: { ...errorMetrics.byCode },
    byStatus: { ...errorMetrics.byStatus },
    recentErrors: errorMetrics.last50.slice(-10),
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  const path = req.originalUrl || req.url;
  recordMetric("ROUTE_NOT_FOUND", 404, `Route not found: ${path}`, path);
  sendError(res, StatusCodes.NOT_FOUND, "ROUTE_NOT_FOUND", "Rota nao encontrada", undefined, { path, method: req.method });
}
