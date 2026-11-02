import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError, type ZodType } from "zod";

const jsonContentType = "application/json; charset=utf-8";

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function allowedOrigins(): Set<string> {
  return new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

export function enforceOrigin(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }

  if (!allowedOrigins().has(origin)) {
    sendError(res, new ApiError(403, "origin_not_allowed", "Request origin is not allowed."));
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  return true;
}

export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== "OPTIONS") {
    return false;
  }

  if (!enforceOrigin(req, res)) {
    return true;
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Setup-Secret,X-CSRF-Token");
  res.status(204).end();
  return true;
}

export function requireMethod(
  req: VercelRequest,
  res: VercelResponse,
  ...methods: string[]
): boolean {
  if (req.method && methods.includes(req.method)) {
    return true;
  }

  res.setHeader("Allow", methods.join(", "));
  sendError(res, new ApiError(405, "method_not_allowed", "Method not allowed."));
  return false;
}

export function parseBody<T>(req: VercelRequest, schema: ZodType<T>): T {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(400, "validation_error", "The request body is invalid.");
    }
    throw new ApiError(400, "invalid_json", "The request body must be valid JSON.");
  }
}

export function getSingleQueryValue(req: VercelRequest, name: string): string | undefined {
  const value = req.query[name];
  if (Array.isArray(value)) {
    throw new ApiError(400, "invalid_query", `Query parameter ${name} must be provided once.`);
  }
  return value;
}

export function sendJson<T>(res: VercelResponse, statusCode: number, body: T): void {
  res.setHeader("Content-Type", jsonContentType);
  res.status(statusCode).json(body);
}

export function sendError(res: VercelResponse, error: unknown): void {
  if (error instanceof ApiError) {
    sendJson(res, error.statusCode, {
      error: { code: error.code, message: error.message },
    });
    return;
  }

  console.error("Unhandled API error", error);
  sendJson(res, 500, {
    error: { code: "internal_error", message: "An unexpected error occurred." },
  });
}
