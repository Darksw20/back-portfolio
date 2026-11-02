import type { VercelRequest } from "@vercel/node";
import { z } from "zod";
import { getCookie, sessionCookieName } from "./cookies.js";
import { getSql } from "./db.js";
import { ApiError } from "./http.js";
import { type SessionRole, verifySessionToken } from "./session.js";

const databaseSessionSchema = z.object({
  id: z.string().min(32),
  user_id: z.coerce.string().regex(/^\d+$/),
  username: z.string(),
  roles: z.array(z.enum(["superuser", "editor"])),
});

export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  username: string;
  roles: SessionRole[];
};

export async function requireAuthenticatedSession(req: VercelRequest): Promise<AuthenticatedSession> {
  const token = getCookie(req, sessionCookieName);
  if (!token) {
    throw new ApiError(401, "authentication_required", "Authentication is required.");
  }

  let claims;
  try {
    claims = await verifySessionToken(decodeURIComponent(token));
  } catch {
    throw new ApiError(401, "invalid_session", "The session is invalid or expired.");
  }

  const sql = getSql();
  const records = await sql`
    SELECT
      s.id,
      s.user_id,
      u.username,
      COALESCE(array_agg(ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}'::text[]) AS roles
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE s.id = ${claims.sid}
      AND s.user_id = ${claims.sub}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.is_active = true
    GROUP BY s.id, s.user_id, u.username
    LIMIT 1
  `;
  const record = databaseSessionSchema.safeParse(records[0]);
  if (!record.success) {
    throw new ApiError(401, "invalid_session", "The session is invalid or expired.");
  }

  const roles = record.data.roles as SessionRole[];
  if (roles.length === 0 || !claims.roles.every((role) => roles.includes(role))) {
    throw new ApiError(401, "invalid_session", "The session is invalid or expired.");
  }

  return {
    sessionId: record.data.id,
    userId: record.data.user_id,
    username: record.data.username,
    roles,
  };
}

export function requireRole(session: AuthenticatedSession, role: SessionRole): void {
  if (!session.roles.includes(role)) {
    throw new ApiError(403, "forbidden", "You do not have permission for this action.");
  }
}

export function requireAnyRole(session: AuthenticatedSession, roles: SessionRole[]): void {
  if (!roles.some((role) => session.roles.includes(role))) {
    throw new ApiError(403, "forbidden", "You do not have permission for this action.");
  }
}
