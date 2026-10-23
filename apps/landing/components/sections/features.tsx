import type { ReactNode } from "react";
import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { Stagger } from "@/components/stagger";
import { Eyebrow } from "@/components/eyebrow";

type Feature = {
  index: string;
  title: string;
  body: ReactNode;
};

const features: Feature[] = [
  {
    index: "01 —",
    title: "Near-zero fees",
    body: "An on-chain router takes the cheapest path, so almost your whole gift survives to grow — not 3–8% lost.",
  },
  {
    index: "02 —",
    title: "Any stablecoin",
    body: "Give in any dollar-pegged coin you hold; it settles 1:1 into the pool, ready to grow.",
  },
  {
    index: "03 —",
    title: "Yield on idle funds",
    body: "Idle funds earn in a halal, riba-free vault, so every gift keeps growing before it's delivered.",
  },
];

export function Features() {
  return (
    <Section id="features" labelledBy="features-title" divider={false}>
      <Reveal>
        <Eyebrow>What you get</Eyebrow>
        <h2
          id="features-title"
          className="mt-5 max-w-[20ch] text-[clamp(1.9rem,1.2rem+2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance"
        >
          How Amanah grows your gift.
        </h2>
      </Reveal>

      <Stagger step={90} className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.index}
            className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-foreground/5"
          >
            <span className="font-serif text-2xl italic text-primary/70 transition-colors duration-300 group-hover:text-primary">
              {feature.index}
            </span>
            <h3 className="mt-4 text-lg font-medium">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </Stagger>
    </Section>
  );
}
