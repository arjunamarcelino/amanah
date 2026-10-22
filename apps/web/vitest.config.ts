import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirror the tsconfig `@/*` -> `./*` path alias (vite doesn't read tsconfig paths).
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

// Pure-logic unit tests only (no jsdom/component tests — see the plan). Live in
// test/ (repo convention) and run in a node environment.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": root },
  },
});
