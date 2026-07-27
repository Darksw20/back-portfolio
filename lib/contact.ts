import { createHmac } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { getSessionJwtSecret } from "./env.js";

export function getSourceIpHash(req: VercelRequest): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const sourceIp = forwardedValue?.split(",")[0]?.trim() ?? req.headers["x-real-ip"];
  if (!sourceIp || Array.isArray(sourceIp)) {
    return null;
  }

  return createHmac("sha256", getSessionJwtSecret()).update(sourceIp).digest("hex");
}
