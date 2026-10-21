import { defineConfig } from "tsup";

// Dual ESM + CJS build so BOTH consumers resolve cleanly:
//  - ESM: apps/web (Next transpile), apps/indexer (NodeNext)  -> dist/index.js
//  - CJS: apps/api (NestJS, module: node16/commonjs)          -> dist/index.cjs
// `dts: true` emits per-format declarations (index.d.ts + index.d.cts); the
// package.json `exports` require-branch points at .d.cts so a CJS consumer gets
// CJS-shaped types (avoids attw FalseCJS). Keep this package STATELESS at module
// scope to avoid the dual-package hazard.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node22",
  outDir: "dist",
});
