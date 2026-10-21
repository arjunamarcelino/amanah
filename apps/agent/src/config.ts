import "dotenv/config";

// Fixed operational constants (not env-tunable — a demo/hero service doesn't need
// per-deploy knobs, and `Number(process.env.X)` would silently yield NaN).
export const RAILS_PATH = "/rails"; // apps/api has no global prefix (verified)
export const CLAUDE_TIMEOUT_MS = 15_000;
export const RAILS_FETCH_TIMEOUT_MS = 5_000;
export const MAX_CANDIDATES = 25; // top-N trim (token / schema-cost guard)

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required`);
  return v;
}

// Frozen at import. `required(...)` throws at boot (not per-request) when a mandatory
// secret/URL is missing — so a misconfigured deploy fails fast instead of silently
// 500-ing or degrading to all-fallback.
export const config = {
  port: Number(process.env.PORT ?? 5000),
  apiUrl: required("API_URL"),
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  agentSharedSecret: required("AGENT_SHARED_SECRET"),
} as const;
