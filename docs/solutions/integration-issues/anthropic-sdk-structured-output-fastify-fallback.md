---
title: "Integrating @anthropic-ai/sdk structured outputs in a Fastify ESM service with a never-crash fallback"
date: 2026-10-22
category: integration-issues
problem_type: integration
component: apps/agent
severity: non-blocking
status: resolved
symptoms:
  - "First @anthropic-ai/sdk integration in the repo — no existing pattern for a resilient paid-LLM endpoint"
  - "messages.parse: unsure whether it throws on refusal/max_tokens or returns, and where the parsed value lives"
  - "Deterministic fallback fires slowly: per-request timeout alone doesn't bound it because the SDK retries timeouts"
  - "Dynamic z.enum structured-output schema recompiles per request (TTFT tail on the client-candidates path)"
  - "A control-char regex written with \\u escapes got stored as raw control bytes in the .ts source"
  - "Unit tests pull real env because config.ts runs required() at import"
  - "close-with-grace killed in-flight inference on SIGTERM; drain delay equalled the worst-case handler"
tags: [anthropic, claude, sdk, structured-outputs, fastify, esm, zod, fallback, timeout, maxretries, prompt-injection, dependency-injection, app-inject, p-limit, catalog]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/7
  - commit: 48aeee3  # feat(shared): rail + route zod schemas
  - commit: 4ccd8c1  # feat(agent): candidate prep + Claude router + fallback
  - commit: 57bf2f4  # feat(agent): app factory, auth, rate-limit, shutdown
  - commit: 034783b  # perf(agent): cap max_tokens at 1024
  - commit: 569e464  # fix(agent): shutdown drain margin
  - commit: a0ff105  # feat(agent): p-limit concurrency cap
  - commit: 994e5ce  # refactor(agent): transport-agnostic decideOffRamp
  - commit: 8e6cc14  # fix(agent): strip control chars from prompt candidate fields
  - commit: 2b23e73  # fix(agent): constant-time secret compare
  - solution: docs/solutions/build-errors/cjs-nestjs-consuming-esm-workspace-package.md
---

# Integrating @anthropic-ai/sdk structured outputs in a Fastify ESM service with a never-crash fallback

## Problem

`apps/agent` is the first Anthropic SDK consumer in the repo: a Fastify v5 (ESM, NodeNext, Node 22)
service whose `POST /route` asks Claude (`claude-opus-4-8`) to pick one payout rail and must **never
crash** — if Claude is slow/unavailable/misbehaving it falls back to a deterministic lowest-fee
choice. Wiring this up surfaced a cluster of non-obvious SDK and resilience gotchas, several of
which compile and pass a naive happy-path test but are silently wrong under load or failure.

Verified against `@anthropic-ai/sdk@1.0.0` (resolved with `zod@4.6.7` via the pnpm catalog).

## Root causes & fixes

### 1. `maxRetries: 0`, because the SDK *retries timeouts*
The SDK's default `maxRetries` is **2**, and it retries timeouts too — so a per-request
`{ timeout }` does **not** bound when your fallback fires: worst-case Claude wall-clock is
`timeout × (maxRetries + 1)`. For a cheap, deterministic fallback you want to fail fast, so construct
the client with `new Anthropic({ apiKey, maxRetries: 0 })` and pass a per-request timeout. Now the
timeout is the true bound and the fallback fires in seconds, not after exponential backoff.

### 2. `messages.parse` returns (doesn't throw) on refusal / max_tokens; `parsed_output` is nullable
`client.messages.parse(params, { timeout })` returns a `ParsedMessage` with
**`parsed_output: T | null`**. It does **not** throw on `stop_reason: "refusal"` or `"max_tokens"` —
it returns with a null `parsed_output`. So the model-path guard is a *returned-value* check, not a
try/catch: check `stop_reason` first (`refusal` / `max_tokens` → fallback), then `parsed_output`
(null → fallback), then membership. The `catch` only handles thrown SDK/network errors.

```ts
const res = await client.messages.parse(
  { model: "claude-opus-4-8", max_tokens: 1024, thinking: { type: "adaptive" },
    output_config: { effort: "low", format: zodOutputFormat(RouteOutputSchema) }, messages: [...] },
  { timeout: CLAUDE_TIMEOUT_MS },
);
if (res.stop_reason === "refusal") return fallback("refusal");
if (res.stop_reason === "max_tokens") return fallback("invalid_output");
const out = res.parsed_output;                  // nullable
if (!out || !inCandidates(out.chosenRail)) return fallback("invalid_output");
```

`zodOutputFormat` comes from `@anthropic-ai/sdk/helpers/zod`; `output_config` holds `effort` **and**
`format` together; `thinking: {type:"adaptive"}` must be set explicitly (omitting it on 4.8 runs
*without* thinking).

### 3. TS SDK error hierarchy: one `instanceof Anthropic.APIError` buckets everything
Unlike the Python SDK (siblings), in the **TypeScript** SDK `APIConnectionError`, `RateLimitError`,
and `APIConnectionTimeoutError` are all **subclasses of `APIError`**. So a single
`err instanceof Anthropic.APIError` classifies every SDK/network/timeout error — no fragile
most-specific-first `instanceof` chain (which mislabels timeouts as "connection" because the
timeout branch sits after its superclass). Log the fine cause via `err.name`; keep the response
reason coarse.

### 4. Use a *stable* output schema, not a per-request `z.enum`
Constraining `chosenRail` to a `z.enum(candidateNames)` recompiles the provider's structured-output
grammar on **every distinct candidate set** (a TTFT tail on the client-supplied path). Keep the
schema static (`{ chosenRail: z.string(), rationale: z.string() }`, converted once at module load)
and enforce "never invent a rail" in code: validate `chosenRail ∈ candidates` and fall back
otherwise. Same functional guarantee, grammar compiled once globally.

### 5. The model selects; your code computes every consequential number
Never trust values the model echoes. The model returns only a *selection* (`chosenRail`); re-derive
`feeBps` (and anything money-adjacent) from the matched source record. Structured outputs guarantee
the JSON *shape*, not truthful values.

### 6. Sanitize client-suppliable fields before interpolating them into the prompt
Any request-supplied string rendered into the prompt is a prompt-injection surface: a crafted rail
`name`/`liquidity` with a newline or a fake `</candidates>` can break the data-block delimiter.
Strip ASCII control chars from those fields at the interpolation point (a prompt-integrity guard,
*not* XSS safety — output rendering must still escape). Also clamp/sanitize the model's free-text
output (e.g. `rationale`) and clamp by **code point** (`[...s].slice(0, n).join("")`) so a trailing
astral char isn't split into a lone surrogate.

### 7. Be lenient with your own upstream, strict with external input
Validate the api's `GET /rails` response with a **lenient** (`.strip()`, zod default) schema so an
additive upstream field doesn't turn a real response into a 502. Use **`.strict()`** only on the
client request body (reject unknown keys). Same object shape, two parse modes.

### 8. Isolate `config`'s import-time side effects from the unit tests
`config.ts` runs `required()` env reads at import. If any module a test imports transitively imports
`config`, the test needs real env. Keep `config` imported **only by the composition root** (`index.ts`)
and put pure values (`RAILS_PATH`, timeouts, caps) in a side-effect-free `constants.ts`. Then the app
factory and router import only `constants`, and tests build the app with injected fakes and zero env.

### 9. Shutdown drain and concurrency must account for the real worst case
`close-with-grace` delay must **exceed** the worst-case handler wall-clock
(`railsTimeout + claudeTimeout × (maxRetries+1)`), plus margin for event-loop lag — otherwise SIGTERM
kills in-flight inference and the caller gets a reset instead of the fallback. Derive the delay from
the timeout constants, not a magic literal. Separately, cap concurrent paid calls with an in-process
limiter (`p-limit`) so a burst queues instead of firing N simultaneous Opus calls that trip the
account rate limit and degrade a whole window to fallback.

### 10. Fastify app-factory + DI makes the LLM path testable with zero network
Return a configured instance from `buildApp(deps)` (no `.listen()`), injecting **narrow function
ports** (`route`, `fetchRails`) rather than the concrete `Anthropic` client — then `app.ts` imports
neither the SDK nor the router internals, and tests drive the full lifecycle via `app.inject()` with
plain async mocks (no `as unknown as` SDK cast). `index.ts` is the only place the real client, env,
logger, and shutdown live. Keep the request→decision orchestration in a transport-agnostic function
(`decideOffRamp`) returning a tagged union, so the HTTP handler is a thin status mapper and a future
MCP tool reuses it verbatim.

## Prevention checklist (next LLM endpoint)

- [ ] `maxRetries: 0` + per-request `{ timeout }`; size `close-with-grace` delay > worst-case handler + margin.
- [ ] Branch on `stop_reason` (refusal/max_tokens) then nullable `parsed_output` then membership; `catch` only for thrown errors; bucket with one `instanceof Anthropic.APIError`.
- [ ] Static structured-output schema; validate the choice + re-derive all numbers from source.
- [ ] Strip control chars from any request data interpolated into the prompt; code-point-clamp model output.
- [ ] Lenient (`.strip`) parse of your own upstream; `.strict()` on client input.
- [ ] `config` (import-time `required()`) only in the composition root; pure constants elsewhere; tests use injected fakes.
- [ ] `buildApp(deps)` factory + `app.inject` tests; transport-agnostic core for MCP parity.
- [ ] New agent dep that uses zod → `"zod": "catalog:"` (single-instance invariant — see the CJS/ESM solution).

## Gotcha: control-char regexes in `.ts` source
A regex like `/[ -]/g` can end up with **raw control bytes** in the source if the editing
path interprets the escapes. Prefer a codepoint predicate (`ch.codePointAt(0)! >= 0x20 && !== 0x7f`)
or build the pattern from a string with doubled backslashes — and grep the diff for stray control
bytes (`rg -nP '[\x00-\x08\x0e-\x1f\x7f]' src`) before committing.
