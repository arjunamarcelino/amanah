import Anthropic from "@anthropic-ai/sdk";
import closeWithGrace from "close-with-grace";
import { config } from "./config.js";
import { CLAUDE_TIMEOUT_MS, RAILS_FETCH_TIMEOUT_MS } from "./constants.js";
import { buildApp } from "./app.js";
import { fetchRails } from "./rails-client.js";
import { routeOffRamp } from "./router.js";

// maxRetries: 0 — the SDK retries timeouts, which would make worst-case Claude wall-clock
// ~2x the per-request timeout and break the shutdown drain. With 0, the per-request
// timeout is the true bound and the deterministic fallback fires fast.
const anthropic = new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 0 });

const app = await buildApp(
  {
    sharedSecret: config.agentSharedSecret,
    fetchRails: (country) => fetchRails(config.apiUrl, country, RAILS_FETCH_TIMEOUT_MS),
    route: (input) =>
      routeOffRamp(input, anthropic, {
        timeoutMs: CLAUDE_TIMEOUT_MS,
        onFallback: (reason, cause) => app.log.warn({ reason, cause }, "routing fallback"),
      }),
  },
  { logger: { redact: ["req.headers.authorization", "*.apiKey", "*.api_key"] } },
);

// delay ≥ worst-case handler (rails 5s + claude 15s = 20s with maxRetries:0) so SIGTERM
// drains an in-flight routing decision instead of killing it mid-inference.
closeWithGrace({ delay: CLAUDE_TIMEOUT_MS + 5_000 }, async ({ err }) => {
  if (err) app.log.error({ err }, "shutdown after error");
  await app.close();
});

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err: unknown) => {
  app.log.error({ err }, "failed to start");
  process.exit(1);
});
