import { z } from "zod";

// Coercion/defaults are fine here — this is internal config, not a request DTO.
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Comma-separated browser origin allowlist for CORS (web :3000; agent :5000 is server-side). */
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  /** Pending rows older than this (minutes) are expired by the sweep. */
  PENDING_TTL_MIN: z.coerce.number().int().positive().default(15),
  /** Request body size cap (unauthenticated write surface). */
  BODY_LIMIT: z.string().default("16kb"),
});

export type Env = z.infer<typeof envSchema>;

/** @nestjs/config validator — throws at bootstrap on invalid env. */
export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
