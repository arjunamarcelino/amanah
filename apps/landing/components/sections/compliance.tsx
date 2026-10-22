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
          Donations are irrevocable charitable gifts — there are no refunds and no donor
          withdrawal.
        </li>
        <li>
          Amanah is not an investment, security, or collective investment scheme; donors receive no
          financial return. Any yield funds the mission, not donors.
        </li>
        <li>
          The protocol currently runs on the Base Sepolia testnet using test tokens — not real
          money, for demonstration and early access.
        </li>
        <li>
          Nothing here is financial, legal, tax, or religious advice. Halal-mode claims are
          best-effort; please verify independently.
        </li>
      </ul>
    </Section>
  );
}
