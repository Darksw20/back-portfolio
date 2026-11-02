import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

const runtimeEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_JWT_SECRET: nonEmpty.min(32),
  INITIAL_SUPERUSER_SETUP_SECRET: nonEmpty.min(32),
  ALLOWED_ORIGINS: nonEmpty,
});

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

export function getRuntimeEnvironment(): RuntimeEnvironment {
  return runtimeEnvironmentSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_JWT_SECRET: process.env.SESSION_JWT_SECRET,
    INITIAL_SUPERUSER_SETUP_SECRET: process.env.INITIAL_SUPERUSER_SETUP_SECRET,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  });
}

export function getDatabaseUrl(): string {
  return z.string().url().parse(process.env.DATABASE_URL);
}

export function getSessionJwtSecret(): string {
  return nonEmpty.min(32).parse(process.env.SESSION_JWT_SECRET);
}
