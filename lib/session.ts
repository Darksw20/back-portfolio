import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { getSessionJwtSecret } from "./env.js";

const sessionClaimsSchema = z.object({
  sub: z.string().regex(/^\d+$/),
  sid: z.string().min(32),
  roles: z.array(z.enum(["superuser", "editor"])).min(1),
});

const issuer = "ricardonavarro.mx";
const sessionLifetime = "8h";

export type SessionRole = "superuser" | "editor";
export type SessionClaims = z.infer<typeof sessionClaimsSchema>;

function getSigningKey(): Uint8Array {
  return new TextEncoder().encode(getSessionJwtSecret());
}

export async function signSessionToken(input: {
  userId: bigint;
  sessionId: string;
  roles: SessionRole[];
}): Promise<string> {
  return new SignJWT({ sid: input.sessionId, roles: input.roles })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.userId.toString())
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(sessionLifetime)
    .sign(getSigningKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, getSigningKey(), { issuer });
  return sessionClaimsSchema.parse(payload);
}
