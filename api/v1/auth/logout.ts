import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCookie, clearSessionCookie, sessionCookieName } from "../../../lib/cookies.js";
import { getSql } from "../../../lib/db.js";
import { enforceOrigin, handlePreflight, requireMethod, sendError } from "../../../lib/http.js";
import { verifySessionToken } from "../../../lib/session.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "POST")) {
    return;
  }

  try {
    const token = getCookie(req, sessionCookieName);
    if (token) {
      try {
        const claims = await verifySessionToken(decodeURIComponent(token));
        await getSql()`UPDATE sessions SET revoked_at = now() WHERE id = ${claims.sid} AND revoked_at IS NULL`;
      } catch {
        // Clearing the client cookie is sufficient when a token is expired or malformed.
      }
    }
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
}
