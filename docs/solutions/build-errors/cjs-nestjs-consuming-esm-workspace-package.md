---
title: "A CommonJS NestJS app consuming an ESM workspace package (tsup dual-build, node16 resolution, Prisma client in dist)"
date: 2026-10-21
category: build-errors
problem_type: build_failure
component: monorepo
severity: blocking
status: resolved
symptoms:
  - "CommonJS NestJS app can't cleanly import an ESM-only workspace package (`\"type\": \"module\"`, no `require` export)"
  - "attw reports FalseCJS — the CJS consumer silently resolves the ESM .d.ts"
  - "Consumer sees a model-less PrismaClient: 'Property campaign does not exist' / 'no exported member Campaign'"
  - "Runtime ERR_REQUIRE_ESM when requiring a `\"type\": \"module\"` package's .js"
  - "prisma.config.ts seems ignored; falls back to the deprecated package.json#prisma key"
tags: [monorepo, pnpm, esm, cjs, dual-build, tsup, nestjs, node16, moduleResolution, exports-map, prisma, attw, publint, catalog]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/6
  - commit: 8252241  # chore(shared): dual ESM+CJS build via tsup
  - commit: e1fa135  # feat(api): node16 resolution + CoreModule
  - commit: 178b112  # fix(db): clean dist before copying generated client
  - commit: 1aa35c0  # chore(db): prisma.config.ts + CJS dist build
  - commit: 3977bd8  # chore(ci): check:exports (attw + publint) gate
  - solution: docs/solutions/build-errors/turbo-monorepo-ci-forge-and-eslint-flat-config.md
---

# A CommonJS NestJS app consuming an ESM workspace package

## Problem

A pnpm/Turborepo monorepo where most packages are ESM (`"type": "module"`, Next.js, a NodeNext
worker) but **NestJS builds CommonJS**. The shared package (`@amanah/shared`) was ESM-only with no
`require` export condition, and the DB package (`@amanah/db`) exported raw `.ts`. Wiring the CJS
Nest app to consume both surfaced a cluster of interlocking build gotchas, several of which pass a
naive `nest build` but are silently wrong.

## Root causes & fixes

### 1. ESM-only package → make it a dual ESM+CJS build (tsup)
A `"type": "module"` package with only an `import` export can't be `require()`d (ERR_REQUIRE_ESM).
Build both formats with `tsup` and a **types-first exports map** whose `require` branch points at a
**`.d.cts`** (CJS-shaped declarations) and a real `.cjs`:

```jsonc
{
  "type": "module",
  "main": "./dist/index.cjs", "module": "./dist/index.js", "types": "./dist/index.d.ts",
  "exports": { ".": {
    "import":  { "types": "./dist/index.d.ts",  "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  } }
}
```
`tsup` with `format: ['esm','cjs'], dts: true` emits `index.js` + `index.cjs` + `index.d.ts` +
`index.d.cts`. Under `"type": "module"`, the CJS build is `.cjs` (so `require` works despite
`type:module`). Keep the package **stateless at module scope** to avoid the dual-package hazard.

### 2. `moduleResolution: "node"` silently ignores the exports map (FalseCJS)
This is the subtle one. The NestJS scaffold shipped `module: "commonjs"` + `moduleResolution: "node"`.
**Classic `node` resolution does not read conditional `exports`** — it falls back to top-level
`main`/`types`, so the CJS app resolves the package's **ESM** `.d.ts` and all the dual-build care is
bypassed. `attw` flags this as **FalseCJS**. Fix: set the Nest app to
`module: "node16"`, `moduleResolution: "node16"` (keeps CJS emit when the package has no
`"type": "module"`, but now honors the `require` condition → `.d.cts`). CJS relative imports stay
extensionless; decorators/`emitDecoratorMetadata` are unaffected.

### 3. `cp -R src/generated dist/generated` NESTS on the second build
`@amanah/db` builds by generating the Prisma client then copying it into `dist`:
`prisma generate && tsc && cp -R src/generated dist/generated`. **`cp -R A B` copies *into* B when B
already exists** → on the 2nd build you get `dist/generated/generated/...`, while the first build's
stale (empty-schema) client lingers at `dist/generated/client`. Consumers then see a **model-less
PrismaClient** (`campaign` delegate / `Campaign` type missing) even though the schema has models.
Fix: **clean `dist` first**: `rm -rf dist && prisma generate && tsc && cp -R src/generated dist/generated`.
(The generated client is `.js`/`.d.ts`/`.wasm`/native engine, so `tsc` won't emit it — you must copy
it, but copy into a clean dir.)

### 4. `prisma.config.ts` requires Prisma ≥ 6.4
On an older pin (`6.2.x`) the config file is **silently ignored** and Prisma falls back to the
deprecated `package.json#prisma` key — so `migrations.seed` / schema path don't take effect. Bump
`prisma` + `@prisma/client` to ≥6.13 (GA) before relying on `prisma.config.ts`. It also disables
automatic `.env` loading — add `import "dotenv/config"` at the top of the config file (+ `dotenv` dep).

### 5. Gate it with `attw` + `publint`; pin one zod with a pnpm catalog
A `check:exports` script (`attw --pack . && publint`) catches exports-map mistakes across node10 /
node16-CJS / node16-ESM / bundler — **but only if a CJS consumer actually exists**, so it must be
paired with fix #2. Use a pnpm **`catalog:`** entry for `zod` so the shared package, the API, and
`nestjs-zod` resolve one physical install (required for `instanceof z.ZodType` across the boundary).
Note: `attw@0.17.x` had a `--pack` crash ("Cannot read properties of undefined (reading 'filename')");
`^0.18.x` fixed it.

## Prevention

- When a CJS app must consume a workspace package, decide the interop up front: dual-build the
  library (tsup) **and** put the consumer on `node16`/`nodenext` resolution — classic `node`
  resolution is the silent trap.
- Any `cp -R <src> <dst>` in a build script: `rm -rf <dst>` first, or it nests on re-run.
- A source-exported (`main: ./src/index.ts`) package can't be consumed by a `tsc`-built CJS app;
  give it a real build that **ships non-TS assets** (Prisma client, wasm, native engines) into `dist`.
- Add `attw`+`publint` to CI from day one, and make sure at least one CJS and one ESM consumer
  exercise the package so FalseCJS/FalseESM actually surface.
- Verify the compiled CJS entry actually `require()`s at runtime (`node -e "require('./dist/...')"`)
  — a green `tsc`/`nest build` does not prove runtime module resolution.
