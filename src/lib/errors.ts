import {
  AuthenticationError,
  ConfigurationError,
  KirhaError,
  NetworkError,
  PlanExpiredError,
  RateLimitError,
  ValidationError,
} from "kirha";

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "CONFIG_INVALID"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "NETWORK"
  | "PLAN_EXPIRED"
  | "API_ERROR"
  | "USAGE"
  | "INTERNAL";

export const EXIT_CODES: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 3,
  AUTH_INVALID: 3,
  CONFIG_INVALID: 2,
  VALIDATION: 2,
  USAGE: 2,
  RATE_LIMIT: 4,
  NETWORK: 5,
  PLAN_EXPIRED: 6,
  API_ERROR: 1,
  INTERNAL: 1,
};

export class CliError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "CliError";
  }
}

export interface FormattedError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export function formatError(err: unknown): FormattedError {
  if (err instanceof CliError) {
    return { code: err.code, message: err.message, details: err.details };
  }
  if (err instanceof AuthenticationError) {
    return { code: "AUTH_INVALID", message: err.message };
  }
  if (err instanceof RateLimitError) {
    return { code: "RATE_LIMIT", message: err.message };
  }
  if (err instanceof PlanExpiredError) {
    return { code: "PLAN_EXPIRED", message: err.message };
  }
  if (err instanceof NetworkError) {
    return { code: "NETWORK", message: err.message };
  }
  if (err instanceof ValidationError) {
    return { code: "VALIDATION", message: err.message };
  }
  if (err instanceof ConfigurationError) {
    return { code: "CONFIG_INVALID", message: err.message };
  }
  if (err instanceof KirhaError) {
    return { code: "API_ERROR", message: err.message };
  }
  if (err instanceof Error) {
    return { code: "INTERNAL", message: err.message };
  }
  return { code: "INTERNAL", message: String(err) };
}
