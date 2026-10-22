import { describe, it, expect } from "vitest";
import { safeUrl } from "@/lib/sanitize";

describe("safeUrl", () => {
  it("allows https and mailto", () => {
    expect(safeUrl("https://example.org/x")).toBe("https://example.org/x");
    expect(safeUrl("mailto:a@b.org")).toBe("mailto:a@b.org");
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>",
    "vbscript:msgbox(1)",
    "http://insecure.org",
    "/relative/path",
    "ftp://x",
    "",
    "   ",
  ])("rejects %j", (raw) => {
    expect(safeUrl(raw)).toBeNull();
  });

  it("handles null/undefined", () => {
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });
});
