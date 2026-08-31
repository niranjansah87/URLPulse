import type { ErrorCode } from "@urlpulse/types";

/**
 * Domain errors carry an HTTP status and a canonical ErrorCode so the Fastify
 * error handler can map them to the ApiError envelope without leaking internals.
 * `details` is optional structured data safe to return to the client (e.g. zod
 * issues), never a stack trace or raw DB error.
 */
export class ApiDomainError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown[];

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown[]) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiDomainError {
  constructor(message: string, details?: unknown[]) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class NotFoundError extends ApiDomainError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends ApiDomainError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

/** Thrown by scaffolded methods whose logic belongs to a later milestone. */
export class NotImplementedError extends ApiDomainError {
  constructor(what: string) {
    super(501, "NOT_IMPLEMENTED", `${what} is not implemented yet`);
  }
}
