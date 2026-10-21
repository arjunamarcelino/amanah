import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import type { RailResponse } from "@amanah/shared";
import {
  prepareCandidates,
  lowestFeeFallback,
  routeOffRamp,
  type RouteModel,
} from "../src/router.js";

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

// A trivial fake of the one SDK method the router uses.
function fakeModel(parse: () => Promise<unknown>): RouteModel {
  return { messages: { parse } } as unknown as RouteModel;
}
const returning = (parsed_output: unknown, stop_reason = "end_turn"): RouteModel =>
  fakeModel(async () => ({ stop_reason, parsed_output }));
const throwing = (err: unknown): RouteModel =>
  fakeModel(async () => {
    throw err;
  });

const candidates = [rail("Wise", 30), rail("GCash", 50)];
const input = { amountUsd: 100, country: "PH", candidates };
const opts = { timeoutMs: 1000 };

describe("prepareCandidates", () => {
  it("filters inactive, sorts cheapest-first, caps", () => {
    const r = prepareCandidates([rail("A", 90), rail("B", 10), rail("X", 5, { active: false })]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.candidates.map((c) => c.name)).toEqual(["B", "A"]);
  });
  it("rejects empty (all inactive)", () => {
    expect(prepareCandidates([rail("A", 1, { active: false })])).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects duplicate names", () => {
    expect(prepareCandidates([rail("Dup", 1), rail("Dup", 2)])).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });
});

describe("lowestFeeFallback", () => {
  it("picks lowest feeBps, breaks ties by name, flags the fallback", () => {
    const r = lowestFeeFallback([rail("B", 30), rail("A", 30), rail("C", 50)], "unavailable");
    expect(r).toMatchObject({
      chosenRail: "A",
      feeBps: 30,
      fallbackUsed: true,
      fallbackReason: "unavailable",
    });
  });
});

describe("routeOffRamp", () => {
  it("returns the model's pick with feeBps re-derived from the candidate", async () => {
    const res = await routeOffRamp(input, returning({ chosenRail: "Wise", rationale: "Lowest fee." }), opts);
    expect(res).toMatchObject({ chosenRail: "Wise", feeBps: 30, fallbackUsed: false });
    expect(res.rationale).toBe("Lowest fee.");
  });
  it("falls back on refusal", async () => {
    const res = await routeOffRamp(input, returning(null, "refusal"), opts);
    expect(res).toMatchObject({ fallbackUsed: true, fallbackReason: "refusal", chosenRail: "Wise" });
  });
  it("falls back on max_tokens truncation", async () => {
    const res = await routeOffRamp(input, returning(null, "max_tokens"), opts);
    expect(res).toMatchObject({ fallbackUsed: true, fallbackReason: "invalid_output" });
  });
  it("falls back when parsed_output is null", async () => {
    const res = await routeOffRamp(input, returning(null), opts);
    expect(res).toMatchObject({ fallbackUsed: true, fallbackReason: "invalid_output" });
  });
  it("falls back when chosenRail is not a candidate", async () => {
    const res = await routeOffRamp(input, returning({ chosenRail: "Invented", rationale: "x" }), opts);
    expect(res).toMatchObject({ fallbackUsed: true, fallbackReason: "invalid_output" });
  });
  it("maps an Anthropic APIError to 'unavailable'", async () => {
    const err = Object.assign(Object.create(Anthropic.APIError.prototype) as Error, {
      name: "APIError",
      message: "boom",
    });
    const res = await routeOffRamp(input, throwing(err), opts);
    expect(res).toMatchObject({ fallbackUsed: true, fallbackReason: "unavailable" });
  });
  it("maps a non-SDK throw to 'invalid_output'", async () => {
    const res = await routeOffRamp(input, throwing(new TypeError("bug")), opts);
    expect(res).toMatchObject({ fallbackUsed: true, fallbackReason: "invalid_output" });
  });
  it("sanitizes control chars and clamps length in the rationale", async () => {
    const dirty = String.fromCharCode(0, 7, 10) + "a".repeat(600);
    const res = await routeOffRamp(input, returning({ chosenRail: "Wise", rationale: dirty }), opts);
    expect(res.rationale.length).toBe(500);
    expect([...res.rationale].every((c) => (c.codePointAt(0) ?? 0) >= 0x20)).toBe(true);
  });
});
