import { defineConfig } from "vitest/config";

// Pure-logic unit tests only (no jsdom/component tests — see the plan). Live in
// test/ (repo convention) and run in a node environment.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
