import type { ReactNode } from "react";
import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { cn } from "@amanah/ui/lib/utils";

type Feature = {
  index: string;
  title: string;
  body: ReactNode;
};

const features: Feature[] = [
  {
    index: "01 —",
    title: "Smart routing, near-zero fees",
    body: "An automated router finds the cheapest on-chain path, shrinking the 3–8% typically lost to fees toward nothing.",
  },
  {
    index: "02 —",
    title: "Give in any stablecoin",
    body: "Donate in the dollar-pegged coin you already hold; it settles 1:1 into the pool, with no manual swapping.",
  },
  {
    index: "03 —",
    title: "Zakat & waqf that sustain themselves",
    body: (
      <>
        Idle funds can earn to extend every gift — and{" "}
        <span aria-hidden="true">🌙</span> Halal mode adds opt-in, riba-free
        handling for those who want it.
      </>
    ),
  },
];

export function Features() {
  return (
    <Section id="features" labelledBy="features-title">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px w-8 bg-border" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          What you get
        </span>
      </div>

      <h2
        id="features-title"
        className="mt-5 max-w-[20ch] text-[clamp(1.9rem,1.2rem+2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance"
      >
        How Amanah protects your gift.
      </h2>

      <Reveal>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.index}
              className={cn(
                "flex flex-col rounded-xl border border-border bg-card p-6",
              )}
            >
              <span className="font-serif italic text-2xl text-primary/70">
                {feature.index}
              </span>
              <h3 className="mt-4 text-lg font-medium">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}
