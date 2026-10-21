import "dotenv/config";

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required`);
  return v;
}

// Frozen at import. `required(...)` throws at boot (not per-request) when a mandatory
// secret/URL is missing — so a misconfigured deploy fails fast instead of silently
// 500-ing or degrading to all-fallback. Imported only by index.ts: unit tests inject
// their own values and never touch process.env. Pure constants live in constants.ts.
export const config = {
  port: Number(process.env.PORT ?? "5000"),
  apiUrl: required("API_URL"),
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  agentSharedSecret: required("AGENT_SHARED_SECRET"),
} as const;
