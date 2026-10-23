import { Section } from "@/components/section";
import { Stagger } from "@/components/stagger";
import { TokenMarquee } from "@/components/token-marquee";

// Stat callout between the hero arc and the problem. Distinct from the hero (which covers
// low-fee, any-stablecoin, verifiable routing): this one is about growth — idle donations earn
// in a halal vault, so a gift keeps giving and the cause receives more than was put in. Early-
// access, so no invented numbers; the asterisk footnote keeps the yield claim honest.
export function Impact() {
  return (
    <Section id="impact" labelledBy="impact-title" className="text-center" divider={false}>
      <Stagger step={90}>
        <span className="inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground">
          Gifts That Grow
        </span>

        <h2
          id="impact-title"
          className="mx-auto mt-6 max-w-[16ch] text-[clamp(2.1rem,1.2rem+3vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-balance"
        >
          <span className="block">Give once.</span>
          <span className="block">It keeps giving.</span>
        </h2>

        <p className="mx-auto mt-5 max-w-[42rem] text-lg leading-relaxed text-foreground-soft md:text-xl">
          Before it&apos;s sent, your donation earns in a halal, riba-free vault — so the cause
          receives even more than you gave.
        </p>

        <p className="mx-auto mt-6 max-w-[40rem] text-xs text-muted-foreground">
          Opt-in yield on idle balances, free of riba.
        </p>

        <div className="mt-12">
          <TokenMarquee />
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            More stablecoins coming soon
          </p>
        </div>
      </Stagger>
    </Section>
  );
}
