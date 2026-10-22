import { Section } from "@/components/section";
import { siteConfig } from "@/lib/site";
import { Badge } from "@amanah/ui/badge";
import { Button } from "@amanah/ui/button";

// The hero is intentionally NOT wrapped in <Reveal>: it is above the fold and holds the
// LCP element (the h1). Gating it behind the JS scroll-reveal would start it at opacity:0
// until hydration, which disqualifies it as an LCP candidate and couples LCP to
// time-to-hydrate. It renders visible immediately.
export function Hero() {
  return (
    <Section id="hero" labelledBy="hero-title">
      <Badge variant="outline" className="text-muted-foreground">
        <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 rounded-full bg-primary" />
        Live on Base Sepolia testnet · early access
      </Badge>

      <h1
        id="hero-title"
        className="mt-6 max-w-[16ch] text-balance text-[clamp(2.5rem,1.6rem+4.8vw,5.25rem)] font-medium leading-[1.03] tracking-[-0.021em]"
      >
        Give once. Protect many. Lose nothing to the middle.
      </h1>

      <p className="mt-6 max-w-[38rem] text-lg leading-relaxed text-foreground-soft md:text-xl">
        Give to any cause — disaster relief, education, medical aid, poverty, or your local
        masjid — and an automated router sends it on-chain by the cheapest path. Almost all of
        it arrives, and you can verify every step.
      </p>

      <div className="mt-9">
        <Button asChild size="lg">
          <a href={siteConfig.appUrl}>Launch the app →</a>
        </Button>
      </div>
    </Section>
  );
}
