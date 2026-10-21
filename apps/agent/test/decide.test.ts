import { describe, it, expect, vi } from "vitest";
import type { RailResponse, RouteResponse } from "@amanah/shared";
import { decideOffRamp, type DecideDeps } from "../src/decide.js";
import { RailsUpstreamError } from "../src/rails-client.js";

const rail = (name: string, feeBps: number, over: Partial<RailResponse> = {}): RailResponse => ({
  id: name,
  name,
  country: "PH",
  feeBps,
  liquidity: "high",
  etaMinutes: 10,
  active: true,
  ...over,
});
const okResult: RouteResponse = { chosenRail: "Wise", feeBps: 30, rationale: "x", fallbackUsed: false };

function makeDeps(fetchImpl?: () => Promise<RailResponse[]>) {
  const fetchRails = vi.fn(fetchImpl ?? (async () => [rail("Wise", 30), rail("GCash", 50)]));
  const route = vi.fn(async (): Promise<RouteResponse> => okResult);
  return { deps: { fetchRails, route } as DecideDeps, fetchRails, route };
}
const req = { amountUsd: 100, country: "PH" };

describe("decideOffRamp", () => {
  it("fetches when candidates are omitted, then routes", async () => {
    const { deps, fetchRails } = makeDeps();
    const res = await decideOffRamp(req, deps);
    expect(fetchRails).toHaveBeenCalledWith("PH");
    expect(res).toMatchObject({ ok: true, candidateCount: 2 });
    if (res.ok) expect(res.result).toEqual(okResult);
  });
  it("uses supplied candidates without fetching", async () => {
    const { deps, fetchRails } = makeDeps();
    const res = await decideOffRamp({ ...req, candidates: [rail("Wise", 30)] }, deps);
    expect(fetchRails).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });
  it("rejects empty candidate sets", async () => {
    const { deps } = makeDeps(async () => []);
    expect(await decideOffRamp(req, deps)).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects duplicate rail names", async () => {
    const { deps } = makeDeps();
    const res = await decideOffRamp({ ...req, candidates: [rail("Dup", 1), rail("Dup", 2)] }, deps);
    expect(res).toEqual({ ok: false, reason: "duplicate" });
  });
  it("propagates RailsUpstreamError without catching", async () => {
    const { deps } = makeDeps(async () => {
      throw new RailsUpstreamError("down");
    });
    await expect(decideOffRamp(req, deps)).rejects.toBeInstanceOf(RailsUpstreamError);
  });
  it("does not call route when preparation fails", async () => {
    const { deps, route } = makeDeps(async () => []);
    await decideOffRamp(req, deps);
    expect(route).not.toHaveBeenCalled();
  });
});
