import { createHash, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import rateLimit from "@fastify/rate-limit";
import {
  RouteRequestSchema,
  type RailResponse,
  type RouteResponse,
  type RouteRejectionReason,
} from "@amanah/shared";
import { RailsUpstreamError } from "./rails-client.js";
import { decideOffRamp } from "./decide.js";

// Generic reason phrases for client-error statuses Fastify/plugins may raise, so the error
// envelope never surfaces a framework-internal message string.
const CLIENT_ERROR_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  413: "Payload Too Large",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
};

// Candidate-rejection reason → HTTP response. Semantic "can't process" cases are 422;
// a country mismatch is malformed input (400).
const REJECTION: Record<RouteRejectionReason, { code: number; error: string; message: string }> = {
  empty: { code: 422, error: "Unprocessable Entity", message: "No candidate rails" },
  duplicate: { code: 422, error: "Unprocessable Entity", message: "Duplicate rail names" },
  country_mismatch: {
    code: 400,
    error: "Bad Request",
    message: "Candidate country does not match the request country",
  },
};

export interface AppDeps {
  /** Narrow ports — app.ts depends on neither the Anthropic SDK nor the router internals,
   *  so unit tests inject plain async functions (no `as unknown as` SDK cast). */
  route: (input: {
    amountUsd: number;
    country: string;
    candidates: RailResponse[];
  }) => Promise<RouteResponse>;
  fetchRails: (country: string) => Promise<RailResponse[]>;
  sharedSecret: string;
}

function constantTimeEq(a: string, b: string): boolean {
  // Hash both to a fixed 32-byte width first, so neither the comparison nor an early
  // length-mismatch branch leaks the secret's length via timing.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function buildApp(
  deps: AppDeps,
  opts: FastifyServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ bodyLimit: 16 * 1024, ...opts });

  await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "ok", service: "agent" }));

  app.post(
    "/route",
    {
      // Shared-secret bearer gate — rejected before any (paid) Claude call.
      preHandler: async (req, reply) => {
        const header = req.headers.authorization ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!constantTimeEq(token, deps.sharedSecret)) {
          return reply
            .code(401)
            .send({ statusCode: 401, error: "Unauthorized", message: "Invalid credentials" });
        }
      },
    },
    async (req, reply) => {
      const parsed = RouteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Request validation failed",
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        });
      }
      const startedAt = performance.now();
      // decideOffRamp owns the transport-agnostic orchestration (resolve → prepare → route);
      // fetchRails inside it may throw RailsUpstreamError → 502 via setErrorHandler.
      const decision = await decideOffRamp(parsed.data, {
        fetchRails: deps.fetchRails,
        route: deps.route,
      });
      if (!decision.ok) {
        const r = REJECTION[decision.reason];
        return reply.code(r.code).send({ statusCode: r.code, error: r.error, message: r.message });
      }

      const { result, candidateCount } = decision;
      // Observability without PII: no raw amountUsd, no full candidate set, no body.
      req.log.info(
        {
          pathServed: result.fallbackUsed ? "fallback" : "model",
          fallbackReason: result.fallbackReason,
          chosenRail: result.chosenRail,
          candidateCount,
          routeMs: Math.round(performance.now() - startedAt),
        },
        "route decision",
      );
      return result;
    },
  );

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof RailsUpstreamError) {
      return reply
        .code(502)
        .send({ statusCode: 502, error: "Bad Gateway", message: "Upstream rails unavailable" });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) {
      // Client errors Fastify/plugins raise (e.g. 429 rate-limit, 413 oversized body) —
      // surface the status with a generic phrase, never the framework-internal string.
      const text = CLIENT_ERROR_TEXT[status] ?? "Client Error";
      return reply.code(status).send({ statusCode: status, error: text, message: text });
    }
    // Anything else: log server-side, return an opaque 500 (never leak internals).
    req.log.error({ err }, "unhandled error");
    return reply
      .code(500)
      .send({ statusCode: 500, error: "Internal Server Error", message: "Internal Server Error" });
  });

  return app;
}
