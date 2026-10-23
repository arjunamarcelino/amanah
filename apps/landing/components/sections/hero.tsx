import Image from "next/image";
import { siteConfig } from "@/lib/site";
import { Button } from "@amanah/ui/button";
import { TiltedGridHero } from "@/components/tilted-grid-hero";

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
      <div className="mx-auto w-full max-w-[64rem] px-[clamp(1.25rem,5vw,3rem)] text-center">
        <h1
          id="hero-title"
          className="mx-auto max-w-[16ch] text-[clamp(2.6rem,1.4rem+4.6vw,4.9rem)] font-medium leading-[1.03] tracking-[-0.021em] text-balance"
        >
          Where every gift reaches further
        </h1>

        <p className="mx-auto mt-6 max-w-[36rem] text-lg leading-relaxed text-foreground-soft md:text-xl">
          Back any cause, give in any stablecoin, and track every step on-chain. Near-zero fees.
        </p>

        <div className="mt-9 flex justify-center">
          <Button asChild size="lg" className="h-12 rounded-full px-9 text-base">
            <a href={siteConfig.appUrl}>Donate Now</a>
          </Button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-foreground-soft">
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
