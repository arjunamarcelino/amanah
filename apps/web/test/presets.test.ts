import { describe, it, expect } from "vitest";
import { presetForSlug, RELEASE_PRESETS } from "@/lib/console/presets";
import { DEMO_BY_ID } from "@/lib/demo-campaigns";

describe("presetForSlug", () => {
  it("returns the preset for a known slug", () => {
    const p = presetForSlug("ph-typhoon-2025");
    expect(p).toEqual(RELEASE_PRESETS["ph-typhoon-2025"]);
    expect(p?.trancheAmount).toBe(500_000_000n);
    expect(p?.detail).toBe("Typhoon Cat 4, Tacloban");
  });

  it("returns null for an unknown slug (miss is a first-class state)", () => {
    expect(presetForSlug("does-not-exist")).toBeNull();
  });
});

describe("preset / demo-campaign slug consistency", () => {
  // Every console preset drives a campaignId = campaignIdFromSlug(slug). If that slug has no
  // DEMO_BY_ID presentation entry, the console can target a campaign the public app can't render
  // (no cover/story) — or one that was never seeded. Keep the preset slugs a subset.
  const demoSlugs = new Set(Object.values(DEMO_BY_ID).map((d) => d.slug));

  for (const slug of Object.keys(RELEASE_PRESETS)) {
    it(`preset slug "${slug}" has a DEMO_BY_ID presentation entry`, () => {
      expect(demoSlugs.has(slug)).toBe(true);
    });
  }
});
