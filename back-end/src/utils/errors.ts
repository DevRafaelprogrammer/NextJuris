import { StatusCodes } from "http-status-codes";

export interface ErrorContext {
  field?: string;
  resource?: string;
  value?: unknown;
  constraint?: string;
  retryAfter?: number;
  requestId?: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly timestamp: string;
  public readonly isOperational: boolean;

  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly context: ErrorContext = {},
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(this.context && Object.keys(this.context).length > 0 ? { context: this.context } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Requisicao invalida", details?: unknown, context?: ErrorContext) {
    super(StatusCodes.BAD_REQUEST, message, "BAD_REQUEST", context, details);
  }
}

export class ValidationError extends AppError {
  constructor(fields: Array<{ field: string; message: string; code?: string }>) {
    super(StatusCodes.UNPROCESSABLE_ENTITY, "Erro de validacao", "VALIDATION_ERROR", {}, fields);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Nao autorizado", context?: ErrorContext) {
    super(StatusCodes.UNAUTHORIZED, message, "UNAUTHORIZED", context);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(context?: ErrorContext) {
    super(StatusCodes.UNAUTHORIZED, "E-mail ou senha incorretos", "INVALID_CREDENTIALS", context);
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super(StatusCodes.UNAUTHORIZED, "Token expirado", "TOKEN_EXPIRED");
  }
}

export class TokenInvalidError extends AppError {
  constructor() {
    super(StatusCodes.UNAUTHORIZED, "Token invalido", "TOKEN_INVALID");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado", context?: ErrorContext) {
    super(StatusCodes.FORBIDDEN, message, "FORBIDDEN", context);
  }
}

export class InsufficientPermissionError extends AppError {
  constructor(requiredRole?: string) {
    super(StatusCodes.FORBIDDEN, "Permissao insuficiente", "INSUFFICIENT_PERMISSION", {
      ...(requiredRole && { requiredRole }),
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Recurso", id?: string) {
    super(StatusCodes.NOT_FOUND, `${resource} nao encontrado`, "NOT_FOUND", {
      resource,
      ...(id && { id }),
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Recurso ja existe", context?: ErrorContext) {
    super(StatusCodes.CONFLICT, message, "CONFLICT", context);
  }
}

export class DuplicateError extends AppError {
  constructor(field: string, value?: string) {
    super(StatusCodes.CONFLICT, `${field} ja cadastrado`, "DUPLICATE_ENTRY", {
      field,
      ...(value && { value }),
    });
  }
}

export class GoneError extends AppError {
  constructor(resource = "Recurso") {
    super(StatusCodes.GONE, `${resource} foi removido permanentemente`, "GONE", { resource });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(maxSize?: string) {
    super(StatusCodes.REQUEST_TOO_LONG, "Payload excede o limite permitido", "PAYLOAD_TOO_LARGE", {
      ...(maxSize && { maxSize }),
    });
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Entidade nao processavel", details?: unknown) {
    super(StatusCodes.UNPROCESSABLE_ENTITY, message, "UNPROCESSABLE_ENTITY", {}, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Muitas requisicoes", retryAfter?: number) {
    super(StatusCodes.TOO_MANY_REQUESTS, message, "TOO_MANY_REQUESTS", {
      ...(retryAfter && { retryAfter }),
    });
  }
}

export class AccountLockedError extends AppError {
  constructor(minutesLeft: number) {
    super(StatusCodes.TOO_MANY_REQUESTS, `Conta bloqueada. Tente novamente em ${minutesLeft} minutos`, "ACCOUNT_LOCKED", {
      retryAfter: minutesLeft * 60,
    });
  }
}

export class AccountSuspendedError extends AppError {
  constructor() {
    super(StatusCodes.FORBIDDEN, "Conta suspensa. Entre em contato com o administrador", "ACCOUNT_SUSPENDED");
  }
}

export class AccountInactiveError extends AppError {
  constructor() {
    super(StatusCodes.FORBIDDEN, "Conta inativa", "ACCOUNT_INACTIVE");
  }
}

export class AccountPendingError extends AppError {
  constructor() {
    super(StatusCodes.FORBIDDEN, "Conta pendente de aprovacao", "ACCOUNT_PENDING");
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service = "Servico", retryAfter?: number) {
    super(StatusCodes.SERVICE_UNAVAILABLE, `${service} temporariamente indisponivel`, "SERVICE_UNAVAILABLE", {
      service,
      ...(retryAfter && { retryAfter }),
    });
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string) {
    super(StatusCodes.SERVICE_UNAVAILABLE, "Erro no banco de dados", "DATABASE_ERROR", { operation });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(StatusCodes.BAD_GATEWAY, `Erro no servico externo: ${service}`, "EXTERNAL_SERVICE_ERROR", {
      service,
      ...(message && { originalMessage: message }),
    });
  }
}

export class FileUploadError extends AppError {
  constructor(message = "Erro no upload do arquivo", context?: ErrorContext) {
    super(StatusCodes.BAD_REQUEST, message, "FILE_UPLOAD_ERROR", context);
  }
}

export class RateLimitExceededError extends AppError {
  constructor(endpoint: string, retryAfter: number) {
    super(StatusCodes.TOO_MANY_REQUESTS, "Limite de requisicoes excedido", "RATE_LIMIT_EXCEEDED", {
      endpoint,
      retryAfter,
    });
  }
}

export const ERROR_CATALOG: Record<string, { status: number; message: string }> = {
  BAD_REQUEST:              { status: 400, message: "Requisicao invalida" },
  INVALID_JSON:             { status: 400, message: "JSON invalido no corpo da requisicao" },
  VALIDATION_ERROR:         { status: 422, message: "Erro de validacao" },
  FILE_UPLOAD_ERROR:        { status: 400, message: "Erro no upload do arquivo" },
  PAYLOAD_TOO_LARGE:        { status: 413, message: "Payload excede o limite" },
  UNAUTHORIZED:             { status: 401, message: "Nao autorizado" },
  INVALID_CREDENTIALS:      { status: 401, message: "Credenciais invalidas" },
  TOKEN_EXPIRED:            { status: 401, message: "Token expirado" },
  TOKEN_INVALID:            { status: 401, message: "Token invalido" },
  FORBIDDEN:                { status: 403, message: "Acesso negado" },
  INSUFFICIENT_PERMISSION:  { status: 403, message: "Permissao insuficiente" },
  ACCOUNT_SUSPENDED:        { status: 403, message: "Conta suspensa" },
  ACCOUNT_INACTIVE:         { status: 403, message: "Conta inativa" },
  ACCOUNT_PENDING:          { status: 403, message: "Conta pendente" },
  NOT_FOUND:                { status: 404, message: "Recurso nao encontrado" },
  ROUTE_NOT_FOUND:          { status: 404, message: "Rota nao encontrada" },
  CONFLICT:                 { status: 409, message: "Conflito de recurso" },
  DUPLICATE_ENTRY:          { status: 409, message: "Registro duplicado" },
  GONE:                     { status: 410, message: "Recurso removido" },
  UNPROCESSABLE_ENTITY:     { status: 422, message: "Entidade nao processavel" },
  TOO_MANY_REQUESTS:        { status: 429, message: "Muitas requisicoes" },
  ACCOUNT_LOCKED:           { status: 429, message: "Conta bloqueada" },
  RATE_LIMIT_EXCEEDED:      { status: 429, message: "Limite excedido" },
  INTERNAL_ERROR:           { status: 500, message: "Erro interno do servidor" },
  DATABASE_ERROR:           { status: 503, message: "Erro no banco de dados" },
  EXTERNAL_SERVICE_ERROR:   { status: 502, message: "Erro no servico externo" },
  SERVICE_UNAVAILABLE:      { status: 503, message: "Servico indisponivel" },
};

export function isOperationalError(err: Error): boolean {
  return err instanceof AppError && err.isOperational;
}
