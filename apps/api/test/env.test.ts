import { describe, it, expect } from "vitest";
import { validateEnv } from "../src/core/config/env.schema";

describe("validateEnv", () => {
  it("applies defaults and coerces PORT", () => {
    const env = validateEnv({ DATABASE_URL: "postgresql://x", PORT: "5050" });
    expect(env.PORT).toBe(5050);
    expect(env.PENDING_TTL_MIN).toBe(15);
    expect(env.CORS_ORIGINS).toBe("http://localhost:3000");
    expect(env.NODE_ENV).toBe("development");
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => validateEnv({})).toThrow();
  });
});
