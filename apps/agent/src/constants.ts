// Pure operational constants — NO side effects, safe to import from any module
// (unlike config.ts, whose required() env reads run at import time and therefore
// belong only to the composition root in index.ts).
export const RAILS_PATH = "/rails"; // apps/api has no global prefix (verified)
export const CLAUDE_TIMEOUT_MS = 15_000;
export const RAILS_FETCH_TIMEOUT_MS = 5_000;
export const MAX_CANDIDATES = 25; // top-N trim (token / schema-cost guard)
// Headroom added to the worst-case handler wall-clock when sizing the shutdown drain, to
// absorb SIGTERM-arrival skew, response serialization, and event-loop lag under load.
export const SHUTDOWN_MARGIN_MS = 3_000;
