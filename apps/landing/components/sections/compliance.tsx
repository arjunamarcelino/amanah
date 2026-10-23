import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { Stagger } from "@/components/stagger";
import { Eyebrow } from "@/components/eyebrow";

export function Compliance() {
  return (
    <Section id="compliance" labelledBy="compliance-title">
      <Reveal>
        <Eyebrow>Good to know</Eyebrow>
        <h2 id="compliance-title" className="mt-4 text-xl font-medium tracking-tight">
          The small print.
        </h2>
      </Reveal>
      <Stagger
        step={70}
        role="list"
        className="mt-6 max-w-[48rem] space-y-3 text-[0.8125rem] leading-relaxed text-muted-foreground"
      >
        <div role="listitem">
          Every donation is an irrevocable charitable gift — no refunds, no withdrawals once you
          give.
        </div>
        <div role="listitem">
          Amanah isn’t an investment, security, or fund, and donors earn no return — any yield
          funds the cause, never you.
        </div>
        <div role="listitem">
          It runs on the Base Sepolia testnet with test tokens during early access — not real
          money.
        </div>
        <div role="listitem">
          Nothing here is financial, legal, tax, or religious advice. Halal handling is
          best-effort; please verify independently.
        </div>
      </Stagger>
    </Section>
  );
}
