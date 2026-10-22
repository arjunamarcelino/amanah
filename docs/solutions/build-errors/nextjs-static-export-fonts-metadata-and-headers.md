---
title: "Next.js 15 static export (output: export): next/font, metadata/viewport, and where headers live"
date: 2026-10-22
category: build-errors
problem_type: build_failure
component: apps/landing
severity: non-blocking
status: resolved
symptoms:
  - "Belief that `output: export` rules out `next/font` (so you reach for system fonts or hand-rolled @font-face)"
  - "`next build` inside Docker/CI could fail with no network — next/font/google fetches from fonts.googleapis.com at build time"
  - "Next 15 build warning when `themeColor`/`colorScheme` are placed in the `metadata` export"
  - "Social link previews show no image / relative og:image URLs rejected by scrapers"
  - "No way to set security headers / redirects from next.config under `output: export`"
  - "A shipped static page could link its CTA to `http://localhost:3000`, or accept a `javascript:` URL as an href"
tags: [nextjs, next15, app-router, static-export, output-export, next-font, metadata, viewport, caddy, csp, tailwind, shadcn, marketing]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/8
  - commit-fonts-local: 9ee294f
  - commit-metadata-viewport: 7789031
  - commit-cta-resolver: 4a89015
  - commit-cta-scheme: 7c0dcfa
  - commit-caddy-headers: da75ba6
  - commit-caddy-hardening: edf462b
  - files:
    - apps/landing/app/layout.tsx
    - apps/landing/lib/site.ts
    - apps/landing/next.config.mjs
    - docker/landing.Dockerfile
    - docker/Caddyfile
---

# Next.js 15 static export: fonts, metadata, and where headers live

`apps/landing` is a fully static Next.js 15 App Router site (`output: "export"`, served by
Caddy as files). A handful of things behave differently under static export than under a
Node server, and the first one is a widespread misconception. This is the playbook.

## 1. `next/font` **is** compatible with `output: "export"` (the real constraint is build-time egress)

**Misconception:** "static export rules out `next/font`; use system fonts or static
`@font-face`." Not true.

**Reality:** `next/font/google` downloads the font CSS + files **at build time**, emits them
as hashed assets under your own origin (`out/_next/static/media/*.woff2`), and injects the
`@font-face` + preload `<link>`s. At runtime the browser makes **zero** requests to Google.
This is fully export-compatible, and it also generates a size-adjusted fallback that
neutralizes font-swap CLS (don't hand-roll `adjustFontFallback`).

The *only* catch: **`next build` itself needs network access to `fonts.googleapis.com`.** A
sandboxed / air-gapped Docker or CI build with no egress will fail there.

**Fix for hermetic/offline builds — `next/font/local` with committed `.woff2`:**

```ts
// app/layout.tsx — module scope (never inside a component)
import localFont from "next/font/local";

const fraunces = localFont({
  src: "./fonts/Fraunces-latin.woff2", // committed variable woff2
  display: "swap",
  weight: "100 900",                   // variable range; omit per-axis `weight` pins
  variable: "--font-fraunces",
});
// <html className={`${fraunces.variable} ...`}> and map to Tailwind fontFamily via the var.
```

Grab the latin variable `.woff2` from the Google CSS API with a browser UA, then commit it:

```bash
UA="Mozilla/5.0 ... Safari/605.1.15"
curl -sA "$UA" "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,100..900&display=swap" \
  | awk '/\/\* latin \*\//{f=1} f&&/woff2/{match($0,/https:[^)]+\.woff2/);print substr($0,RSTART,RLENGTH);exit}'
# download that URL → app/fonts/Fraunces-latin.woff2
```

`next/font/local` reads the local file, so the build needs no network. `font-optical-sizing:
auto` (in globals.css) still drives a variable font's `opsz` axis. Trade-off: you ship the
full weight range of a variable file and can't subset weights out — fine for a marketing page.

**Decision guide:** default to `next/font/google` (simplest, self-hosts). Switch to
`next/font/local` the moment the build must run without internet (hardened CI, air-gapped
VPS build).

## 2. `themeColor` / `colorScheme` moved to a `viewport` export in Next 15

Putting them in `metadata` triggers a build warning. Use the separate typed export:

```ts
import type { Viewport } from "next";
export const viewport: Viewport = { themeColor: "#faf7f0", colorScheme: "light" };
```

## 3. Metadata/OG under export: set `metadataBase` or scrapers break

OG/Twitter image URLs must be **absolute** or Facebook/LinkedIn/X reject them. Without
`metadataBase`, Next emits a relative `og:image` and warns.

```ts
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),          // REQUIRED for absolute og:image / canonical
  openGraph: { images: ["/og.png"], /* ... */ },  // resolves to https://host/og.png
  // ...
};
```

- A **static `public/og.png`** (1200×630) is the lowest-risk choice. `opengraph-image.tsx`
  (Satori) *does* also work under export (build-time PNG) but pulls in extra machinery.
- `app/icon.svg` / `app/robots.ts` / `app/sitemap.ts` / `app/not-found.tsx` all work under
  export (`not-found.tsx` emits `out/404.html`).
- Confirmed **unsupported** under export: request-reading metadata, Server Actions, route
  handlers reading `Request`, middleware, redirects/rewrites/**headers** in `next.config`,
  ISR, `next/image` default loader (set `images.unoptimized: true`).

## 4. Security headers / redirects / 404-status live in **Caddy**, not next.config

Because `output: export` can't emit headers, they belong at the edge (`docker/Caddyfile`)
and/or the file-server (`docker/landing.Dockerfile`). Split of concerns that works here:

- **File-server (landing container):** `encode zstd gzip`; immutable cache for
  `/_next/static/*`, `must-revalidate` for HTML; `handle_errors` → serve `/404.html`.
  Gotcha: a bare `rewrite * /404.html; file_server` inside `handle_errors` can emit the page
  as **HTTP 200** (soft-404) — verify on deploy (`curl -I https://host/nope` → 404).
- **Edge (reverse proxy):** CSP, `Strict-Transport-Security`, `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and a `www → apex` 308.
  - **HSTS directive is `includeSubDomains`** (camelCase, no underscore). `include_subDomains`
    is silently ignored and makes a `preload` submission ineligible.
  - A self-contained static page can run a tight CSP: `default-src 'self'; img-src 'self'
    data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src
    'self'; object-src 'none'; frame-ancestors 'none'`. `'unsafe-inline'` for script is
    unavoidable (no nonce under export; Next injects inline bootstrap/hydration) but low-risk
    with zero third-party script and no user input.

## 5. `NEXT_PUBLIC_*` env is inlined at build — resolve the CTA safely

Under export, `process.env.NEXT_PUBLIC_*` and `NODE_ENV` are **textually inlined at build**.
Centralize the value and validate it so a shipped page never links to localhost or a
`javascript:`/`data:` URL:

```ts
// lib/site.ts
export function resolveAppUrl(rawEnv: string | undefined, nodeEnv: string | undefined): string {
  const fromEnv = rawEnv?.trim();                       // treat blank ("") as unset
  const url = fromEnv ||
    (nodeEnv === "production" ? "https://app.amanah.help" : "http://localhost:3000");
  const { protocol } = new URL(url);                    // throws on malformed input...
  if (protocol !== "https:" && protocol !== "http:")    // ...but also accepts javascript:/data:
    throw new Error(`must be an http(s) URL, got: ${url}`);
  return url;                                            // return RAW (don't .toString() — adds a trailing slash)
}
```

Fail the build loudly on a bad value rather than shipping a broken/hostile CTA. The CTA is a
plain cross-origin `<a href>` (not `next/link`), same tab.

## Prevention / checklist for the next static Next app in this repo

- [ ] `next.config.mjs`: `output: "export"`, `images.unoptimized: true`, `transpilePackages`
      for any workspace UI package.
- [ ] Fonts: `next/font/google` by default; `next/font/local` + committed `.woff2` if the
      build must be offline. Keep the font call at module scope.
- [ ] `metadataBase` set; `themeColor`/`colorScheme` in a `viewport` export, not `metadata`.
- [ ] Static `public/og.png`; `app/not-found.tsx` for `out/404.html`.
- [ ] All headers / redirects / 404-status in Caddy. HSTS = `includeSubDomains`. Verify the
      404 returns a 404 status on first deploy.
- [ ] Single source for the app URL; validate scheme; never fall back to localhost in prod.
- [ ] Tailwind `content` must glob the UI package source (`../../packages/ui/src/**`), and
      the app owns its own token `:root` block + `@layer base` reset (don't import the UI
      package globals) — see `apps/web` for the pattern.

## Cross-references

- Repo conventions for consuming workspace packages + flat ESLint:
  [[turbo-monorepo-ci-forge-and-eslint-flat-config]],
  [[cjs-nestjs-consuming-esm-workspace-package]].
- PR #8 (the landing build + its review fixes) is the worked example for everything above.
