import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public retryable = false,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function requestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function errorResponse(error: unknown, id: string) {
  const apiError =
    error instanceof ApiError
      ? error
      : error instanceof ZodError
        ? new ApiError(
            "INVALID_REQUEST",
            error.issues[0]?.message
              ? `Request validation failed: ${error.issues[0].message}`
              : "Request validation failed.",
            422,
            false,
            error.issues,
          )
      : new ApiError(
          "INTERNAL_ERROR",
          "Unexpected server error.",
          500,
          true,
        );
  const body: ApiErrorBody = {
    error: {
      code: apiError.code,
      message: apiError.message,
      request_id: id,
      retryable: apiError.retryable,
      details: apiError.details,
    },
  };
  return NextResponse.json(body, { status: apiError.status });
}

export async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }
}

export function requireIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value || value.length < 8 || value.length > 128) {
    throw new ApiError(
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must contain between 8 and 128 characters.",
      400,
    );
  }
  return value;
}
