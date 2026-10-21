import { describe, it, expect, vi } from "vitest";
import type { RailResponse, RouteResponse } from "@amanah/shared";
import { buildApp } from "../src/app.js";

const okResult: RouteResponse = {
  chosenRail: "Wise",
  feeBps: 30,
  rationale: "Lowest fee.",
  fallbackUsed: false,
};

describe("GET /health", () => {
  it("returns ok without auth", async () => {
    const app = await buildApp(
      {
        sharedSecret: "s",
        route: vi.fn(async (): Promise<RouteResponse> => okResult),
        fetchRails: vi.fn(async (): Promise<RailResponse[]> => []),
      },
      { logger: false },
    );
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", service: "agent" });
  });
});
