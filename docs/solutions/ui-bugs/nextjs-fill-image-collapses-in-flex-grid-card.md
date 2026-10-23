---
title: "next/image fill cover collapses to a gray strip in a multi-column card grid (aspect-ratio box + flex/overflow)"
date: 2026-10-24
category: ui-bugs
problem_type: ui_bug
component: apps/web
severity: visible
status: resolved
symptoms:
  - "Campaign card cover images don't show — the 16:9 box is just the gray bg-muted placeholder"
  - "Images appear at a narrow viewport (1-column grid) but collapse to gray when the grid becomes multi-column"
  - "The static showcase cards show their images fine while the live campaign cards (same markup shape) don't"
  - "No 404s, no console error: the raw file AND the /_next/image optimizer both return 200 image/jpeg"
tags: [next.js, next-image, fill, aspect-ratio, flexbox, css-grid, overflow-hidden, min-height, object-cover, layout, ui]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/15
  - review-doc: docs/reviews/2026-10-24-pr15-web-ui-overhaul-review.md (local-only)
  - commit: 20ca5ae (GoFundMe-style discover — CampaignCard/CampaignHero cover layout)
  - related-solution: docs/solutions/ui-bugs/stagger-reveal-cloneelement-custom-component-noop.md
---

# next/image `fill` cover collapses to a gray strip in a multi-column card grid

## Problem

Campaign cards on the discover grid rendered their title/cause/progress fine, but the 16:9 cover
area showed only the gray `bg-muted` placeholder — no photo. Reported repeatedly as "the image
card not working." Two tells narrowed it down:

- **It showed at a narrow viewport and collapsed when the grid went multi-column.** "Gray, but
  when I make the screen small, it shows."
- **The static "same engine" showcase cards showed their images fine**, while the live campaign
  cards — visually the same card shape — did not. ("Other disaster card works but the active one
  not.")

## Investigation

Everything server-side checked out, which sent the search in the wrong direction at first:

- The files exist under `apps/web/public/campaigns/*.jpg`.
- The slug→id cover map resolved correctly — `campaignId === campaignIdFromSlug(slug)`, and the
  API's active campaign ids matched the map keys exactly.
- Both the raw path **and** Next's optimizer returned `200 image/jpeg`:

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "http://localhost:3000/campaigns/relief.jpg"                                   # 200 image/jpeg
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "http://localhost:3000/_next/image?url=%2Fcampaigns%2Frelief.jpg&w=640&q=75"   # 200 image/jpeg
```

- CSP was `Content-Security-Policy-Report-Only` with `img-src 'self'` — can't block, and allows
  same-origin images anyway.

So the image was fetchable; this was a **browser layout** problem, not a data/serving one. The
decisive clue was the comparison: the **showcase card worked, the live card didn't**, and the only
structural difference was the card's outer container — the working showcase used a **`flex flex-col`**
outer while the broken live card had been "fixed" to a **`block`** outer. The box that collapsed was
the 16:9 cover, whose only child is an absolute `fill` image.

A `shrink-0` on the cover box (attempted first) did not reliably fix it; switching the outer to
`block` actively made it worse.

## Root cause

A `next/image` with `fill` renders as `position: absolute; inset: 0`, so it contributes **no
intrinsic size** to its parent. The parent (the `aspect-[16/9]` box) therefore has **zero content
height** — its height must come entirely from the aspect-ratio transferred from its resolved width.

Whether that height actually materializes depends on the box's formatting context:

- In the **card grid**, `align-items: stretch` (the grid default) gives each card a **definite
  row height** equal to the tallest card. The card's outer has `overflow-hidden` (to clip the
  rounded corners / hover zoom). **Per the flexbox spec, `overflow` other than `visible` sets a
  flex item's automatic minimum size to `0`** (instead of min-content). With the cover box as a
  flex item that has zero content height and a now-zero min-height, the flex distribution under
  the stretched, definite height can collapse the aspect box to a sliver — a thin gray strip.
- At a **single-column** width there's no equal-height stretch, so the aspect box keeps its
  width-derived height and the image shows — which is exactly the "collapses only in the
  multi-column grid" symptom.

The showcase card didn't collapse because its outer stayed `flex flex-col`, where the aspect box
is a flex child whose transferred aspect-ratio height resolves cleanly; the live card regressed
when its outer was changed to `block`.

## Solution

Make the card's outer a **`flex flex-col`** container (mirroring the working showcase card), with
the 16:9 cover as its first flex child and the text content as the growing child
(`commit 20ca5ae`, `components/CampaignCard.tsx` / `components/CampaignHero.tsx`):

```tsx
// Outer: flex column — the cover's aspect-ratio box resolves its height as a flex child.
// A `block` outer collapsed it under the grid's equal-height stretch.
<Link className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card ...">
  {/* 16:9 cover — only child is an absolute `fill` image, so its height comes from aspect-ratio */}
  <div className="relative aspect-[16/9] w-full bg-muted">
    <Image src={cover} alt="" fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
           className="object-cover ..." />
    {/* overlay tags */}
  </div>
  <div className="flex flex-1 flex-col gap-3 p-4">{/* title / cause / FundingProgress */}</div>
</Link>
```

For the featured hero, the same change: switch its outer `Link` from `block` to
`flex flex-col` so the wide cover box resolves its height (`components/CampaignHero.tsx`).

## Prevention

- **A `fill` image needs its ancestor to establish a real height.** `fill` contributes no size,
  so the `aspect-[x/y]` box above it must resolve a height — reliably done when its **parent is a
  flex column** (`flex flex-col`), or by giving the box an explicit height. Don't assume
  aspect-ratio alone survives every formatting context.
- **Test cover images in the actual multi-column grid, not just one card / one breakpoint.** The
  bug only appears under `align-items: stretch` with definite row heights. "Shows at mobile width"
  is a red flag for a flex/grid collapse, not proof it works.
- **`overflow-hidden` on a flex container zeroes its items' automatic min-size.** If a flex item
  must keep an intrinsic/aspect height, either keep the item in a flex-column parent (so the
  aspect transfer resolves) or set an explicit `min-h`/height — `shrink-0` alone is not sufficient
  when the item's content height is zero.
- **When server checks pass (file 200, optimizer 200, src correct) but the image is still blank,
  stop debugging the data path and inspect the box's computed height in devtools** — it's almost
  always a collapsed container, not a broken image. (In this repo, browser preview is driver-less
  by preference, so reason from the "works at 1 column / breaks at N columns" signal plus the
  computed-height check rather than screenshots.)

## Cross-references

- PR #15 — web UI overhaul (GoFundMe-style discover/detail/donate).
- Review: `docs/reviews/2026-10-24-pr15-web-ui-overhaul-review.md` (local only).
- `apps/web/components/CampaignCard.tsx`, `apps/web/components/CampaignHero.tsx`,
  `apps/web/components/SameEngineShowcase.tsx` (the working flex-col reference).
- CSS Flexbox: `min-width`/`min-height: auto` becomes `0` when `overflow` is not `visible`
  (automatic minimum size rule). next/image `fill`: parent must be `position: relative` and have
  a resolvable size.
