import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuthenticatedSession } from "../../../lib/auth.js";
import { enforceOrigin, handlePreflight, requireMethod, sendError, sendJson } from "../../../lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET")) {
    return;
  }

  try {
    const session = await requireAuthenticatedSession(req);
    sendJson(res, 200, { user: { id: session.userId, username: session.username, roles: session.roles } });
  } catch (error) {
    sendError(res, error);
  }
}
