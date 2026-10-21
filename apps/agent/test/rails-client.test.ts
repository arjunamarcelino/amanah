import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRails, RailsUpstreamError } from "../src/rails-client.js";

const rail = {
  id: "c",
  name: "GCash",
  country: "PH",
  feeBps: 50,
  liquidity: "high",
  etaMinutes: 10,
  active: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: () => Promise<Response>): void {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("fetchRails", () => {
  it("parses a well-formed response", async () => {
    stubFetch(async () => new Response(JSON.stringify([rail]), { status: 200 }));
    const rails = await fetchRails("http://api:4000", "PH", 1000);
    expect(rails).toHaveLength(1);
    expect(rails[0]?.name).toBe("GCash");
  });

  it("tolerates an additive upstream field (lenient parse)", async () => {
    stubFetch(async () => new Response(JSON.stringify([{ ...rail, newField: 1 }]), { status: 200 }));
    const rails = await fetchRails("http://api:4000", "PH", 1000);
    expect(rails[0]?.name).toBe("GCash");
  });

  it("throws RailsUpstreamError on non-2xx", async () => {
    stubFetch(async () => new Response("nope", { status: 503 }));
    await expect(fetchRails("http://api:4000", "PH", 1000)).rejects.toBeInstanceOf(RailsUpstreamError);
  });

  it("throws RailsUpstreamError on network failure", async () => {
    stubFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(fetchRails("http://api:4000", "PH", 1000)).rejects.toBeInstanceOf(RailsUpstreamError);
  });

  it("throws RailsUpstreamError on malformed shape", async () => {
    stubFetch(async () => new Response(JSON.stringify([{ bogus: true }]), { status: 200 }));
    await expect(fetchRails("http://api:4000", "PH", 1000)).rejects.toBeInstanceOf(RailsUpstreamError);
  });

  it("throws RailsUpstreamError when the upstream returns too many rails", async () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ ...rail, id: `r${i}`, name: `rail-${i}` }));
    stubFetch(async () => new Response(JSON.stringify(many), { status: 200 }));
    await expect(fetchRails("http://api:4000", "PH", 1000)).rejects.toBeInstanceOf(RailsUpstreamError);
  });

  it("url-encodes the country in the query", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await fetchRails("http://api:4000", "Côte d'Ivoire", 1000);
    expect(String(spy.mock.calls[0]?.[0])).toContain("%C3%B4"); // ô, encoded
  });
});
