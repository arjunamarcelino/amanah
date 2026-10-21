import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "../lib/site";

describe("resolveAppUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    expect(resolveAppUrl("https://app.amanah.help", "production")).toBe(
      "https://app.amanah.help",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(resolveAppUrl("  https://staging.amanah.help  ", "production")).toBe(
      "https://staging.amanah.help",
    );
  });

  it("does not normalize a trailing slash (exact CTA href match)", () => {
    expect(resolveAppUrl("https://app.amanah.help", "production")).not.toBe(
      "https://app.amanah.help/",
    );
  });

  it("falls back to the public app URL in production when unset", () => {
    expect(resolveAppUrl(undefined, "production")).toBe("https://app.amanah.help");
  });

  it("treats a blank value as unset", () => {
    expect(resolveAppUrl("", "production")).toBe("https://app.amanah.help");
    expect(resolveAppUrl("   ", "production")).toBe("https://app.amanah.help");
  });

  it("never links to localhost in a production build", () => {
    expect(resolveAppUrl(undefined, "production")).not.toContain("localhost");
  });

  it("falls back to the web dev port outside production", () => {
    expect(resolveAppUrl(undefined, "development")).toBe("http://localhost:3000");
    expect(resolveAppUrl(undefined, undefined)).toBe("http://localhost:3000");
  });

  it("throws on a malformed URL", () => {
    expect(() => resolveAppUrl("not-a-url", "production")).toThrow();
  });
});
