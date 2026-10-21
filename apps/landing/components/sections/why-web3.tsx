import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { cn } from "@amanah/ui/lib/utils";

const points = [
  {
    label: "On the record",
    body: "Every transfer is recorded on-chain, so anyone can follow where a gift actually went.",
  },
  {
    label: "One open pool",
    body: "Balances and flows are public to inspect, not sealed inside a back office.",
  },
  {
    label: "No middle skim",
    body: "Funds move wallet-to-pool without an intermediary taking a cut along the way.",
  },
];

export function WhyWeb3() {
  return (
    <Section id="why-web3" labelledBy="why-web3-title">
      <Reveal>
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-border" aria-hidden="true" />
          <span className="text-sm font-medium tracking-wide text-muted-foreground">
            Why it needs Web3
          </span>
        </div>

        <h2
          id="why-web3-title"
          className="mt-6 max-w-[22ch] text-[clamp(1.9rem,1.2rem+2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance"
        >
          Transparency you can check yourself.
        </h2>

        <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-foreground-soft">
          The reason to put charity on-chain isn’t hype — it’s that the money becomes auditable by
          anyone, with no trusted middle layer to skim or stall it.
        </p>

        <ul className="mt-10 grid gap-0 md:grid-cols-3 md:gap-8">
          {points.map((point) => (
            <li
              key={point.label}
              className={cn(
                "border-t border-border pt-6",
                "mt-6 first:mt-0",
                "md:mt-0 md:pt-8",
              )}
            >
              <h3 className="text-lg font-medium text-foreground">{point.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}
