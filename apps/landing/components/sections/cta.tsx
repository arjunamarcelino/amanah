import { siteConfig } from "@/lib/site";
import { Button } from "@amanah/ui/button";
import { Reveal } from "@/components/reveal";

// Closing CTA band: a two-line headline (second line in pine italic), a short lead, and the
// primary action into the app. Soft pine glow over the warm paper. No border-b — the footer
// below carries its own border-t.
export function CallToAction() {
  return (
    <section id="get-started" aria-labelledby="cta-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_32%,hsl(144_45%_45%/0.12),transparent_70%)]"
      />
      <div className="mx-auto w-full max-w-[64rem] px-[clamp(1.25rem,5vw,3rem)] py-[clamp(5rem,11vw,9rem)] text-center">
        <Reveal>
          <h2
            id="cta-title"
            className="mx-auto max-w-[18ch] text-[clamp(2.4rem,1.4rem+3.6vw,4.5rem)] font-medium leading-[1.04] tracking-[-0.02em] text-balance"
          >
            <span className="block text-foreground">Give to any cause —</span>
            <span className="block italic text-primary">and watch your gift grow.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-[40rem] text-lg leading-relaxed text-foreground-soft md:text-xl">
            Donate in any stablecoin, follow every step on-chain, and let the vault stretch it
            further.
          </p>

          <div className="mt-9 flex justify-center">
            <Button asChild size="lg" className="h-12 rounded-full px-9 text-base">
              <a href={siteConfig.appUrl}>
                Donate Now <span aria-hidden="true">→</span>
              </a>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
