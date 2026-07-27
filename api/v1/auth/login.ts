import { randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { setSessionCookie } from "../../../lib/cookies.js";
import { getSql } from "../../../lib/db.js";
import {
  ApiError,
  enforceOrigin,
  handlePreflight,
  parseBody,
  requireMethod,
  sendError,
  sendJson,
} from "../../../lib/http.js";
import { verifyPassword } from "../../../lib/password.js";
import { signSessionToken, type SessionRole } from "../../../lib/session.js";

const loginInputSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(128),
});

type UserForLogin = {
  id: string | number;
  username: string;
  password_hash: string;
  is_active: boolean;
  roles: SessionRole[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "POST")) {
    return;
  }

  try {
    const input = parseBody(req, loginInputSchema);
    const sql = getSql();
    const users = (await sql`
      SELECT
        u.id,
        u.username,
        u.password_hash,
        u.is_active,
        COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.username = ${input.username}
      GROUP BY u.id
      LIMIT 1
    `) as UserForLogin[];
    const user = users[0];
    if (!user || !user.is_active || !(await verifyPassword(input.password, user.password_hash))) {
      throw new ApiError(401, "invalid_credentials", "Invalid username or password.");
    }

    const sessionId = randomBytes(32).toString("base64url");
    await sql`
      INSERT INTO sessions (id, user_id, expires_at, user_agent)
      VALUES (
        ${sessionId},
        ${user.id},
        now() + interval '8 hours',
        ${req.headers["user-agent"]?.slice(0, 512) ?? null}
      )
    `;
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

    const token = await signSessionToken({
      userId: BigInt(user.id),
      sessionId,
      roles: user.roles,
    });
    setSessionCookie(res, token);
    sendJson(res, 200, {
      user: { id: String(user.id), username: user.username, roles: user.roles },
    });
  } catch (error) {
    sendError(res, error);
  }
}
