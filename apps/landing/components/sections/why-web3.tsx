import { Reveal } from "@/components/reveal";
import { Eyebrow } from "@/components/eyebrow";
import { cn } from "@amanah/ui/lib/utils";

const points = [
  {
    label: "On the record",
    body: "Every transfer is written on-chain — anyone can trace exactly where a gift went.",
  },
  {
    label: "Open pool",
    body: "Balances and flows are public to inspect, never sealed inside a back office.",
  },
  {
    label: "No middle skim",
    body: "Funds move wallet-to-cause with no intermediary taking a cut along the way.",
  },
];

// Soft on-brand pine tint for the section field (distinct from the warm paper above/below).
const FIELD = "hsl(146 28% 95%)";

export function WhyWeb3() {
  return (
    <section id="why-web3" aria-labelledby="why-web3-title" className="relative">
      {/* Curved top transition: the coloured field domes up in the centre to meet the section
          above, leaving the warm paper showing in the top corners (GoFundMe-style arc). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          backgroundColor: FIELD,
          borderTopLeftRadius: "50% 88px",
          borderTopRightRadius: "50% 88px",
        }}
      />

      <div className="mx-auto w-full max-w-[69rem] px-[clamp(1.25rem,5vw,3rem)] pb-[clamp(4.5rem,9vw,8rem)] pt-[clamp(6.5rem,11vw,11rem)]">
        <Reveal>
          <Eyebrow>Why it needs Web3</Eyebrow>

          <h2
            id="why-web3-title"
            className="mt-6 max-w-[22ch] text-[clamp(1.9rem,1.2rem+2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance"
          >
            Transparency you can check yourself.
          </h2>

          <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-foreground-soft">
            Putting charity on-chain isn’t hype — it makes every dollar auditable by anyone, with
            no middle layer to skim or stall it.
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
      </div>
    </section>
  );
}
