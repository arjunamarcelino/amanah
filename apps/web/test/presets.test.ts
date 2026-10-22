import { describe, it, expect } from "vitest";
import { presetForSlug, RELEASE_PRESETS } from "@/lib/console/presets";

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
