import { describe, it, expect } from "vitest";
import { deriveOperatorStep, type OperatorReads } from "@/lib/console/operatorStep";

const base: OperatorReads = {
  donated: 1_000_000_000n,
  released: 0n,
  releaseType: "PARAMETRIC",
  canRelease: false,
  activatedAt: 0n,
  releaseDelay: 0n,
  now: 1_000n,
  hasPendingPayout: false,
  routed: false,
};

describe("deriveOperatorStep", () => {
  it("routed wins over everything", () => {
    expect(deriveOperatorStep({ ...base, routed: true, hasPendingPayout: true }).step).toBe("paid");
  });

  it("a ready pending payout → can_route", () => {
    expect(deriveOperatorStep({ ...base, hasPendingPayout: true }).step).toBe("can_route");
  });

  it("no donations → awaiting_donations", () => {
    expect(deriveOperatorStep({ ...base, donated: 0n }).step).toBe("awaiting_donations");
  });

  it("donations but condition not met → needs_trigger", () => {
    expect(deriveOperatorStep({ ...base, canRelease: false }).step).toBe("needs_trigger");
  });

  it("condition met but still inside T+N → awaiting_unlock", () => {
    const s = deriveOperatorStep({
      ...base,
      canRelease: true,
      activatedAt: 1_000n,
      releaseDelay: 100n,
      now: 1_050n,
    });
    expect(s.step).toBe("awaiting_unlock");
  });

  it("unlocked with remaining cap → can_release", () => {
    const s = deriveOperatorStep({
      ...base,
      canRelease: true,
      activatedAt: 1_000n,
      releaseDelay: 10n,
      now: 2_000n,
      released: 400_000_000n,
    });
    expect(s.step).toBe("can_release");
  });

  it("unlocked but fully released → fully_released", () => {
    const s = deriveOperatorStep({
      ...base,
      canRelease: true,
      now: 2_000n,
      released: 1_000_000_000n,
    });
    expect(s.step).toBe("fully_released");
  });
});
