---
title: "CI build job fails: turbo runs forge where it isn't installed, and ESLint flat config isn't wired"
date: 2026-10-20
category: build-errors
problem_type: build_failure
component: ci
severity: blocking
status: resolved
symptoms:
  - "GitHub Actions `build` job exits 1 while the `contracts` job passes"
  - "command (apps/.../contracts) pnpm run build exited (1) — forge: command not found"
  - "command (apps/agent) pnpm run lint exited (1)"
  - "ESLint: couldn't find a configuration file / triple-slash-reference on next-env.d.ts"
tags: [turbo, monorepo, ci, github-actions, eslint, flat-config, foundry, pnpm]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/1
  - commit-cause: fa6eebc
  - commit-fix: 71f6837
---

# CI build job fails: turbo runs `forge` where it isn't installed, and ESLint flat config isn't wired

## Problem

The first CI run after scaffolding the monorepo (commit `fa6eebc`) failed. The workflow has two
jobs; `contracts` (Foundry) passed, but the Node `build` job exited 1 at the
`Build / lint / test` step with two distinct errors:

```
X command (/home/runner/work/amanah/amanah/packages/contracts) pnpm run build exited (1)
X command (/home/runner/work/amanah/amanah/apps/agent)          pnpm run lint  exited (1)
```

The job ran:

```bash
pnpm turbo run build lint test
```

## Root cause

Two independent causes, both from running every workspace task in the Node job:

1. **`forge` isn't available in the Node job.** `@amanah/contracts` defines `build: "forge build"`
   and `test: "forge test"`. `turbo run build ... test` fans those out, but Foundry is only
   installed in the separate `contracts` job — so `forge` is not on `PATH` and the task exits 1.

2. **ESLint 9 flat config was never actually wired.** Packages declared `"lint": "eslint ."`, but:
   - ESLint 9 resolves `eslint.config.*` **per working directory**. No package had a local
     `eslint.config.mjs` (only `@amanah/config` exported one), so `eslint .` couldn't find a config.
   - Some packages were missing `eslint` and/or `@amanah/config` as devDeps, so the binary / shared
     config wasn't resolvable.
   - `apps/web` used `next lint`, which needs `eslint-config-next` (not installed).
   - Once wired, ESLint also flagged generated/library files: `next-env.d.ts`
     (`@typescript-eslint/triple-slash-reference`) and shadcn empty marker interfaces
     (`@typescript-eslint/no-empty-object-type`).

## Solution (commit `71f6837`)

### 1. Scope the Node job; keep Foundry in its own job

`.github/workflows/ci.yml` — the Node job builds and lints everything **except** contracts, and no
longer runs `test` (there are no JS tests; `forge test` runs in the `contracts` job):

```yaml
      - name: Build + lint (contracts build/test run in the contracts job)
        run: pnpm turbo run build lint --filter=!@amanah/contracts
```

### 2. Give every linted package a local flat config

Each linted package gets an `eslint.config.mjs` that re-exports the shared config:

```js
// apps/*/eslint.config.mjs and packages/{shared,ui}/eslint.config.mjs
export { default } from "@amanah/config/eslint";
```

### 3. Declare the deps the lint step needs

Add `eslint` and `@amanah/config` as devDeps wherever they were missing (api, agent, landing;
web already had `@amanah/config`). Switch web off `next lint`:

```jsonc
// apps/web/package.json
"lint": "eslint .",            // was "next lint"
"devDependencies": { "eslint": "^9.17.0", "@amanah/config": "workspace:*", ... }
```

### 4. Make the shared config scaffold-friendly

`packages/config/eslint.config.mjs`:

```js
ignores: [ /* ...dist/.next/out/coverage/node_modules/generated... */, "**/next-env.d.ts" ],
rules: {
  "no-undef": "off",                               // TypeScript already checks this
  "@typescript-eslint/no-empty-object-type": "off", // shadcn marker interfaces
  "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
}
```

## Verification

Run the **exact** CI command locally before pushing:

```bash
pnpm turbo run build lint --filter='!@amanah/contracts'
# -> 13 successful, 13 total
```

Then CI (run `39294892386`) went green on both jobs: `build` ✓ and `contracts` ✓.

## Prevention

- **Split CI by toolchain.** Keep one job per language runtime: a Node job for `turbo run build lint`
  and a separate job that installs the native toolchain (Foundry). Any turbo task whose script shells
  out to a non-Node tool (`forge`, `cargo`, …) must either be excluded from the Node job via
  `--filter=!<pkg>` or have that toolchain installed in the job that runs it.
- **One `eslint.config.*` per linted package.** ESLint 9 flat config is resolved per cwd; a single
  root/shared config is not enough when `eslint .` runs inside each package. Re-export the shared
  config and declare `eslint` + the shared-config package as devDeps.
- **Ignore framework-generated files** (`next-env.d.ts`, generated clients) in the shared ignores.
- **Always reproduce the CI command locally** (same flags) before pushing — the failure was a
  verbatim repro of the one-line Node-job command.

## Related

- PR [#1](https://github.com/arjunamarcelino/amanah/pull/1) (where the green CI is observed)
- Cause: scaffold commit `fa6eebc`; fix: `71f6837`
