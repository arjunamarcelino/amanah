import type { CSSProperties } from "react";
import Image from "next/image";
import { DonateButton } from "@/components/donate-button";
import { TiltedGridHero } from "@/components/tilted-grid-hero";

// Per-element start offsets for the on-load stagger (ms). The headline leads at 0 and, being
// translate-only (hero-rise-t), keeps its first paint instant so it stays the LCP element.
const delay = (ms: number) => ({ "--hero-delay": `${ms}ms` }) as CSSProperties;

// Cause photos that stream through the curved band below the hero copy.
const HERO_IMAGES = [
  { src: "/hero/relief.jpg" },
  { src: "/hero/clinic.jpg" },
  { src: "/hero/classroom.jpg" },
  { src: "/hero/masjid-waqf.jpg" },
  { src: "/hero/cyclone.jpg" },
];

// Centered, light hero: headline (the LCP element) + short lead in GoFundMe's cadence, the
// primary CTA, then a "Live on Base" chain line — and below, a curved row of cause photos that
// streams right-to-left around a cylinder (TiltedGridHero). `[overflow-x:clip]` keeps any spill
// from adding a horizontal scrollbar.
export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative pt-[clamp(3rem,6vw,5.5rem)] [overflow-x:clip]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[65%] bg-[radial-gradient(70%_100%_at_50%_0%,hsl(144_45%_45%/0.06),transparent_70%)]"
      />
      <div className="mx-auto w-full max-w-[64rem] px-[clamp(1.25rem,5vw,3rem)] text-center">
        <h1
          id="hero-title"
          style={delay(0)}
          className="hero-rise-t mx-auto max-w-[16ch] text-[clamp(2.6rem,1.4rem+4.6vw,4.9rem)] font-medium leading-[1.03] tracking-[-0.021em] text-balance"
        >
          Where every gift reaches further
        </h1>

        <p
          style={delay(140)}
          className="hero-rise mx-auto mt-6 max-w-[36rem] text-lg leading-relaxed text-foreground-soft md:text-xl"
        >
          Back any cause, give in any stablecoin, and track every step on-chain. Near-zero fees.
        </p>

        <div style={delay(240)} className="hero-rise mt-9 flex justify-center">
          <DonateButton />
        </div>

        <p
          style={delay(340)}
          className="hero-rise mt-6 flex items-center justify-center gap-2 text-sm text-foreground-soft"
        >
          <span>Live on</span>
          <Image
            src="/chains/base-logo.svg"
            alt="Base"
            width={75}
            height={19}
            className="h-[1.1rem] w-auto"
          />
        </p>
      </div>

      <TiltedGridHero
        images={HERO_IMAGES}
        speed={6}
        tileHeight={34}
        className="mt-[clamp(1rem,3vw,2rem)] h-[clamp(15rem,26vw,22rem)] w-full"
      />
    </section>
  );
}
