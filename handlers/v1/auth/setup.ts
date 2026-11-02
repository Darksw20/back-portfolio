import { randomBytes, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { setSessionCookie } from "../../../lib/cookies.js";
import { getSql } from "../../../lib/db.js";
import { getRuntimeEnvironment } from "../../../lib/env.js";
import {
  ApiError,
  enforceOrigin,
  handlePreflight,
  parseBody,
  requireMethod,
  sendError,
  sendJson,
} from "../../../lib/http.js";
import { hashPassword } from "../../../lib/password.js";
import { signSessionToken } from "../../../lib/session.js";

const setupInputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(64).regex(/^[a-z0-9_-]+$/),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string(),
});

type CreatedUser = { id: string | number };
type ExistingUser = { exists: boolean };

function setupSecretMatches(providedSecret: string | undefined, expectedSecret: string): boolean {
  if (!providedSecret) {
    return false;
  }

  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(expectedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "POST")) {
    return;
  }

  try {
    const environment = getRuntimeEnvironment();
    const setupSecretHeader = req.headers["x-setup-secret"];
    const setupSecret = Array.isArray(setupSecretHeader) ? setupSecretHeader[0] : setupSecretHeader;
    if (!setupSecretMatches(setupSecret, environment.INITIAL_SUPERUSER_SETUP_SECRET)) {
      throw new ApiError(401, "invalid_setup_secret", "The setup secret is invalid.");
    }

    const input = parseBody(req, setupInputSchema);
    const sql = getSql();
    const existingUser = (await sql`SELECT EXISTS (SELECT 1 FROM users) AS exists`) as ExistingUser[];
    if (existingUser[0]?.exists) {
      throw new ApiError(409, "setup_already_complete", "A user already exists.");
    }

    const passwordHash = await hashPassword(input.password);
    const createdUsers = (await sql`
      WITH new_user AS (
        INSERT INTO users (username, email, password_hash)
        VALUES (${input.username}, ${input.email}, ${passwordHash})
        RETURNING id
      ), new_profile AS (
        INSERT INTO profiles (owner_user_id)
        SELECT id FROM new_user
      )
      INSERT INTO user_roles (user_id, role)
      SELECT id, 'superuser' FROM new_user
      RETURNING user_id AS id
    `) as CreatedUser[];
    const userId = createdUsers[0]?.id;
    if (userId === undefined) {
      throw new ApiError(500, "setup_failed", "Unable to create the initial user.");
    }

    const sessionId = randomBytes(32).toString("base64url");
    await sql`
      INSERT INTO sessions (id, user_id, expires_at, user_agent)
      VALUES (
        ${sessionId},
        ${userId},
        now() + interval '8 hours',
        ${req.headers["user-agent"]?.slice(0, 512) ?? null}
      )
    `;
    const token = await signSessionToken({
      userId: BigInt(userId),
      sessionId,
      roles: ["superuser"],
    });
    setSessionCookie(res, token);
    sendJson(res, 201, { user: { id: String(userId), username: input.username, roles: ["superuser"] } });
  } catch (error) {
    sendError(res, error);
  }
}
