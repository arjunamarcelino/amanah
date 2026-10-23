import { Section } from "@/components/section";
import { Eyebrow } from "@/components/eyebrow";

export function Compliance() {
  return (
    <Section id="compliance" labelledBy="compliance-title">
      <Eyebrow>Good to know</Eyebrow>
      <h2 id="compliance-title" className="mt-4 text-xl font-medium tracking-tight">
        The small print.
      </h2>
      <ul className="mt-6 max-w-[48rem] space-y-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
        <li>
          Every donation is an irrevocable charitable gift — no refunds, no withdrawals once you
          give.
        </li>
        <li>
          Amanah isn’t an investment, security, or fund, and donors earn no return — any yield
          funds the cause, never you.
        </li>
        <li>
          It runs on the Base Sepolia testnet with test tokens during early access — not real
          money.
        </li>
        <li>
          Nothing here is financial, legal, tax, or religious advice. Halal handling is
          best-effort; please verify independently.
        </li>
      </ul>
    </Section>
  );
}
