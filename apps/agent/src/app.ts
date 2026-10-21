import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { RouteRequestSchema, type RailResponse, type RouteResponse } from "@amanah/shared";
import { prepareCandidates } from "./router.js";

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
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
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
      const { amountUsd, country } = parsed.data;

      // fetchRails throws RailsUpstreamError (statusCode 502) → handled by setErrorHandler.
      const fetched = parsed.data.candidates ?? (await deps.fetchRails(country));

      const prep = prepareCandidates(fetched);
      if (!prep.ok) {
        const message = prep.reason === "empty" ? "No candidate rails" : "Duplicate rail names";
        return reply.code(422).send({ statusCode: 422, error: "Unprocessable Entity", message });
      }

      const startedAt = performance.now();
      const result = await deps.route({ amountUsd, country, candidates: prep.candidates });
      // Observability without PII: no raw amountUsd, no full candidate set, no body.
      req.log.info(
        {
          pathServed: result.fallbackUsed ? "fallback" : "model",
          fallbackReason: result.fallbackReason,
          chosenRail: result.chosenRail,
          candidateCount: prep.candidates.length,
          routeMs: Math.round(performance.now() - startedAt),
        },
        "route decision",
      );
      return result;
    },
  );

  app.setErrorHandler((err, req, reply) => {
    const e = err as { statusCode?: number; name?: string; message?: string };
    const status = e.statusCode ?? 500;
    if (status < 500) {
      // client errors incl. 429 from rate-limit — safe to surface as-is
      return reply
        .code(status)
        .send({ statusCode: status, error: e.name ?? "Error", message: e.message ?? "Error" });
    }
    if (status === 502) {
      return reply
        .code(502)
        .send({ statusCode: 502, error: "Bad Gateway", message: "Upstream rails unavailable" });
    }
    // Never leak internals on a true 500.
    req.log.error({ err }, "unhandled error");
    return reply
      .code(500)
      .send({ statusCode: 500, error: "Internal Server Error", message: "Internal Server Error" });
  });

  return app;
}
