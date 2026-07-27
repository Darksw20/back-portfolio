import type { VercelRequest } from "@vercel/node";
import { z } from "zod";
import { ApiError, getSingleQueryValue } from "./http.js";

const localeSchema = z.enum(["es-MX", "en-US"]);

export function getLocale(req: VercelRequest): "es-MX" | "en-US" {
  const locale = getSingleQueryValue(req, "locale") ?? "es-MX";
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) {
    throw new ApiError(400, "invalid_locale", "Unsupported locale.");
  }
  return parsed.data;
}
