import { describe, it, expect, vi } from "vitest";
import type { RailResponse, RouteResponse } from "@amanah/shared";
import { buildApp } from "../src/app.js";
import { RailsUpstreamError } from "../src/rails-client.js";

const SECRET = "test-secret";
const auth = { authorization: `Bearer ${SECRET}` };

const rail = (name: string, feeBps: number): RailResponse => ({
  id: name,
  name,
  country: "PH",
  feeBps,
  liquidity: "high",
  etaMinutes: 10,
  active: true,
});
const okResult: RouteResponse = {
  chosenRail: "Wise",
  feeBps: 30,
  rationale: "Lowest fee.",
  fallbackUsed: false,
};

async function makeApp() {
  const route = vi.fn(async (): Promise<RouteResponse> => okResult);
  const fetchRails = vi.fn(async (): Promise<RailResponse[]> => [rail("Wise", 30), rail("GCash", 50)]);
  const app = await buildApp({ sharedSecret: SECRET, route, fetchRails }, { logger: false });
  return { app, route, fetchRails };
}

const body = { amountUsd: 100, country: "PH" };

describe("POST /route — auth", () => {
  it("401 without a bearer token, and the router is never called", async () => {
    const { app, route } = await makeApp();
    const res = await app.inject({ method: "POST", url: "/route", payload: body });
    expect(res.statusCode).toBe(401);
    expect(route).not.toHaveBeenCalled();
  });
  it("401 with a wrong bearer token", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/route",
      headers: { authorization: "Bearer wrong" },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /route — happy paths", () => {
  it("200 returns the router's decision and fetches rails for the country", async () => {
    const { app, route, fetchRails } = await makeApp();
    const res = await app.inject({ method: "POST", url: "/route", headers: auth, payload: body });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ chosenRail: "Wise", feeBps: 30, fallbackUsed: false });
    expect(fetchRails).toHaveBeenCalledWith("PH");
    expect(route).toHaveBeenCalledTimes(1);
  });
  it("200 passes a fallback result straight through", async () => {
    const { app, route } = await makeApp();
    route.mockResolvedValueOnce({
      chosenRail: "GCash",
      feeBps: 50,
      rationale: "x",
      fallbackUsed: true,
      fallbackReason: "unavailable",
    });
    const res = await app.inject({ method: "POST", url: "/route", headers: auth, payload: body });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ fallbackUsed: true, fallbackReason: "unavailable" });
  });
  it("uses supplied candidates without calling the api", async () => {
    const { app, fetchRails } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/route",
      headers: auth,
      payload: { ...body, candidates: [rail("Wise", 30)] },
    });
    expect(res.statusCode).toBe(200);
    expect(fetchRails).not.toHaveBeenCalled();
  });
});

describe("POST /route — rejections (router never called)", () => {
  it("400 on an invalid body", async () => {
    const { app, route } = await makeApp();
    const res = await app.inject({ method: "POST", url: "/route", headers: auth, payload: {} });
    expect(res.statusCode).toBe(400);
    expect(route).not.toHaveBeenCalled();
  });
  it("422 when no active candidates are found", async () => {
    const { app, route, fetchRails } = await makeApp();
    fetchRails.mockResolvedValueOnce([]);
    const res = await app.inject({ method: "POST", url: "/route", headers: auth, payload: body });
    expect(res.statusCode).toBe(422);
    expect(route).not.toHaveBeenCalled();
  });
  it("422 on duplicate rail names", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/route",
      headers: auth,
      payload: { ...body, candidates: [rail("Dup", 10), rail("Dup", 20)] },
    });
    expect(res.statusCode).toBe(422);
  });
  it("400 when a supplied candidate's country doesn't match the request", async () => {
    const { app, route } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/route",
      headers: auth,
      payload: {
        ...body,
        candidates: [
          { id: "x", name: "Wise", country: "US", feeBps: 30, liquidity: "high", etaMinutes: 10, active: true },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(route).not.toHaveBeenCalled();
  });
  it("502 when the rails upstream fails", async () => {
    const { app, route, fetchRails } = await makeApp();
    fetchRails.mockRejectedValueOnce(new RailsUpstreamError("down"));
    const res = await app.inject({ method: "POST", url: "/route", headers: auth, payload: body });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ statusCode: 502, error: "Bad Gateway" });
    expect(route).not.toHaveBeenCalled();
  });
});
