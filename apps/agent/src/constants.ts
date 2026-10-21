// Pure operational constants — NO side effects, safe to import from any module
// (unlike config.ts, whose required() env reads run at import time and therefore
// belong only to the composition root in index.ts).
export const RAILS_PATH = "/rails"; // apps/api has no global prefix (verified)
export const CLAUDE_TIMEOUT_MS = 15_000;
export const RAILS_FETCH_TIMEOUT_MS = 5_000;
export const MAX_CANDIDATES = 25; // top-N trim (token / schema-cost guard)
// Upper bound on rails accepted from the api fetch — a runaway upstream becomes a clean
// 502 instead of an unbounded array sorted on the event loop. Generous vs real responses.
export const MAX_UPSTREAM_RAILS = 200;
// Headroom added to the worst-case handler wall-clock when sizing the shutdown drain, to
// absorb SIGTERM-arrival skew, response serialization, and event-loop lag under load.
export const SHUTDOWN_MARGIN_MS = 3_000;
// Cap on concurrent (paid) Claude calls per instance. A request burst queues rather than
// firing N simultaneous Opus calls that could trip the account rate limit → all-fallback.
export const MAX_CONCURRENT_CLAUDE_CALLS = 8;
