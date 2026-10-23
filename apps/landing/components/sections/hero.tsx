import Image from "next/image";
import { siteConfig } from "@/lib/site";
import { Badge } from "@amanah/ui/badge";
import { Button } from "@amanah/ui/button";

// Full-bleed hero: a disaster-relief photo (public/amanah-hero.webp) sits behind the copy,
// with a left→right dark scrim so the floating text stays legible over the bright scene.
// NOT wrapped in <Reveal>: this is above the fold and holds the LCP element (the h1).
// Gating it behind the JS scroll-reveal would start it at opacity:0 until hydration, which
// disqualifies it as an LCP candidate. The <Image> carries `priority` for the same reason.
export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[34rem] items-center overflow-hidden border-b border-border/70 md:min-h-[42rem]"
    >
      <Image
        src="/amanah-hero.webp"
        alt="Aid workers handing relief supplies to residents after a typhoon"
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover object-[70%_center]"
      />
      {/* Scrim: darkest on the left where the copy floats, clearing to the right so the
          people in the photo stay visible. Second layer lifts contrast at the bottom edge. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07160d]/85 via-[#07160d]/55 to-[#07160d]/10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#07160d]/40 to-transparent" />

      <div className="mx-auto w-full max-w-[69rem] px-[clamp(1.25rem,5vw,3rem)] py-[clamp(4.5rem,9vw,8rem)]">
        <Badge variant="outline" className="border-white/30 bg-white/5 text-white/90 backdrop-blur-sm">
          <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 rounded-full bg-white" />
          Live on Base Sepolia testnet · early access
        </Badge>

        <h1
          id="hero-title"
          className="mt-6 max-w-[16ch] text-balance text-[clamp(2.5rem,1.6rem+4.8vw,5.25rem)] font-medium leading-[1.03] tracking-[-0.021em] text-background [text-shadow:0_1px_24px_rgba(7,22,13,0.45)]"
        >
          Give once. Protect many. Lose nothing to the middle.
        </h1>

        <p className="mt-6 max-w-[38rem] text-lg leading-relaxed text-background/85 md:text-xl">
          Give to any cause — disaster relief, education, medical aid, poverty, or your local
          masjid — and an automated router sends it on-chain by the cheapest path. Almost all of
          it arrives, and you can verify every step.
        </p>

        <div className="mt-9">
          <Button asChild size="lg">
            <a href={siteConfig.appUrl}>Launch the app →</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
