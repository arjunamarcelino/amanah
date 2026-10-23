---
title: "Staggered scroll-reveal silently no-ops on custom-component children (cloneElement data-* not forwarded)"
date: 2026-10-24
category: ui-bugs
problem_type: ui_bug
component: apps/landing
severity: silent
status: resolved
symptoms:
  - "Some elements in a <Stagger> never animate in — they're just statically visible while their siblings cascade"
  - "The leading <Eyebrow> in a section shows immediately; the following h2/p/list fade up"
  - "The featured campaign card never reveals; the 2x2 grid cards fade as one block instead of cascading individually"
  - "No console error, no type error — the reveal attributes are simply absent from the rendered DOM node"
tags: [react, cloneElement, prop-forwarding, next.js, scroll-reveal, animation, data-attributes, intersection-observer, accessibility, landing]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/14
  - review-doc: docs/reviews/2026-10-23-pr14-landing-overhaul-review.md (local-only)
  - commit-fix: 2601ac9 (forward props through Eyebrow + CampaignCard)
  - commit-related: 74016ce (reduced-motion gating in the cause-tunnel rewrite)
---

# Staggered scroll-reveal silently no-ops on custom-component children

## Problem

The landing site reveals section content on scroll via a CSS contract: an element tagged
`[data-reveal]` starts hidden (`html.js [data-reveal]:not([data-show])`) and transitions to its
final state once `data-show` is set. A `<Stagger>` wrapper drives this for a *group*, cloning
`data-reveal` / `data-show` / an incremental `--reveal-delay` onto each of its direct children so
they cascade in.

It worked for most sections — but two spots never animated:

- **`sections/problem.tsx`** — the leading `<Eyebrow>` stayed statically visible while the
  `h2`, paragraph, and fee-bar below it cascaded.
- **`sections/discover.tsx`** — the featured `<CampaignCard>` never revealed at all, and the
  inner `<Stagger>` around the 2×2 grid revealed the whole subgrid as one block instead of
  cascading the four cards.

No error of any kind — the entrance animation was just silently missing on those nodes.

## Investigation

- Confirmed `html.js` was set (inline script in `layout.tsx`), so the reveal system was live and
  firing correctly for the intrinsic-element children (`<div>`, `<h2>`, `<li>`…).
- The pattern held: **every failing child was a custom React component** (`Eyebrow`,
  `CampaignCard`); every working child was an intrinsic DOM element.
- Inspected what `Stagger` does:

```tsx
// components/stagger.tsx — clones the reveal contract onto each direct child
cloneElement(child, {
  "data-reveal": "",
  "data-show": inView ? "" : undefined,
  style: { ...prevStyle, "--reveal-delay": `${start + i * step}ms` },
});
```

- `cloneElement` merges those props into the element's props — but a component only puts them on
  a real DOM node if **it forwards them**. `Eyebrow` and `CampaignCard` accepted only their own
  named props and spread nothing onto their root, so `data-reveal` / `data-show` / `style` were
  received and dropped. The CSS selector `[data-reveal]:not([data-show])` therefore never matched
  a DOM node → no hidden start state → no transition.

## Root cause

**`cloneElement` sets props on the React element, not on the DOM.** When the child is a custom
component, the injected `data-*` / `style` only reach the DOM if that component spreads them onto
its root element. `Eyebrow` and `CampaignCard` didn't, so the reveal contract silently evaporated
on those children. Intrinsic elements (`div`, `h2`, `li`) forward unknown attributes to the DOM by
default, which is why only the custom-component call sites broke.

A secondary wrinkle: `CampaignCard`'s root `<a>` already had its own `hover:-translate-y-1`
transform transition. Even if it *had* forwarded the reveal, the reveal's `transform` transition
and the hover `transform` transition would fight on the same element.

## Solution

Two complementary fixes (commit `2601ac9`):

**1. Make the reused kicker forward arbitrary props to its root.**

```tsx
// components/eyebrow.tsx
export function Eyebrow({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...rest}>
      {/* …hairline + label… */}
    </div>
  );
}
```

**2. Carry the reveal on a wrapper so it never fights the card's own hover transform.**

```tsx
// components/sections/discover.tsx
function CampaignCard({
  c,
  featured = false,
  ...rest
}: { c: Campaign; featured?: boolean } & HTMLAttributes<HTMLDivElement>) {
  // Reveal rides on this wrapper (from <Stagger>); the inner <a> keeps its own hover translate.
  return (
    <div {...rest} className="h-full">
      <a className="group flex h-full flex-col transition-transform hover:-translate-y-1 …">
        {/* …image / title / progress… */}
      </a>
    </div>
  );
}
```

Now the reveal attributes land on a real DOM node, the cascade fires, and the hover transform on
the inner `<a>` is isolated from the reveal transform on the wrapper.

**Alternative (not taken):** have `Stagger` wrap *every* child in its own `<span data-reveal>`
instead of cloning onto the child. That fixes all cases uniformly and sidesteps the transform
conflict, but it injects wrapper nodes that can disturb grid/flow layout (margins, grid-item
identity), so forwarding props was the lower-risk choice here.

## Prevention

- **Any component used as a reveal/animation target must forward `...rest` + `style` to its root.**
  If it won't, wrap it (`<Stagger><div>…custom…</div></Stagger>`) so the attributes land on a DOM
  node you control.
- **Treat "it works on `<div>` but not on my component" as a prop-forwarding smell.** Intrinsic
  elements forward unknown attributes; custom components don't unless written to.
- **Keep reveal transforms and hover transforms on different elements.** Two `transform`
  transitions on one node fight; put entrance motion on a wrapper and interaction motion on the
  inner element.
- **Reduced-motion is a related trap in the same codebase (commit `74016ce`):** gating only the
  *obvious* motion isn't enough. The 3D cause-tunnel's `useReducedMotion()` originally disabled
  only the pointer parallax while the scroll-driven fly-through kept running. When honoring
  `prefers-reduced-motion`, short-circuit **all** vestibular motion (scroll-linked transforms,
  scale, parallax), not just one layer — render a static snapshot instead.

## Cross-references

- PR #14 — landing overhaul + motion pass.
- Review: `docs/reviews/2026-10-23-pr14-landing-overhaul-review.md` (P2 #2) — local only.
- `components/stagger.tsx`, `components/eyebrow.tsx`, `components/sections/discover.tsx`.
- React docs: `cloneElement` merges props onto the element; forwarding to the DOM is the
  component's responsibility.
