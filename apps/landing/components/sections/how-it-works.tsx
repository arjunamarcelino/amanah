import { type ReactNode } from "react";
import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { Stagger } from "@/components/stagger";
import { Eyebrow } from "@/components/eyebrow";
import { SectionHeading } from "@/components/section-heading";
import { cn } from "@amanah/ui/lib/utils";

type Step = {
  icon: "donate" | "pool" | "vault" | "grow" | "release" | "delivered";
  title: string;
  body: string;
  highlight?: boolean;
};

// The money's journey, end to end, as a vertical timeline. The "grow" step is where Amanah
// earns yield — idle funds work in a halal vault between giving and delivery — so it's filled.
const steps: Step[] = [
  { icon: "donate", title: "You donate", body: "Give in any stablecoin — gasless, straight from your wallet." },
  { icon: "pool", title: "Into the pool", body: "Your gift joins the campaign pool, recorded on-chain for anyone to inspect." },
  { icon: "vault", title: "Idle funds go to the vault", body: "While they wait to be deployed, funds are put to work in a halal, riba-free vault." },
  { icon: "grow", title: "It grows", body: "The vault earns riba-free yield, so the pool gets bigger than what was given.", highlight: true },
  { icon: "release", title: "Release at maturity", body: "Funds unlock to the cause on verified milestones or parametric triggers." },
  { icon: "delivered", title: "Delivered, near-zero fees", body: "The router sends it the cheapest way — almost all arrives, every step traceable." },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-it-works-title">
      <Reveal>
        <Eyebrow>How it works</Eyebrow>

        <SectionHeading id="how-it-works-title" className="mt-6">
          Where your money goes — and grows.
        </SectionHeading>

        <p className="mt-5 text-lg leading-relaxed text-foreground-soft">
          Follow every step on-chain. Between the moment you give and the moment it’s delivered,
          idle funds earn in a halal vault — so more reaches the cause than you put in.
        </p>
      </Reveal>

      <Stagger step={80} role="list" className="mt-12">
        {steps.map((step, i) => {
          const notLast = i < steps.length - 1;
          return (
            <div key={step.title} role="listitem" className="group flex gap-5">
              {/* icon column + connecting line */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "inline-flex size-12 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105",
                    step.highlight
                      ? "border-primary/40 bg-primary text-primary-foreground"
                      : "border-border bg-card text-primary",
                  )}
                >
                  <StepIcon icon={step.icon} />
                </span>
                {notLast ? <span className="mt-2 w-px grow bg-border" /> : null}
              </div>

              {/* content — fills the full container width */}
              <div className={cn("flex-1 pt-1.5", notLast && "pb-10")}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-medium text-foreground">{step.title}</h3>
                  {step.highlight ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      + yield
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 leading-relaxed text-foreground-soft">{step.body}</p>
              </div>
            </div>
          );
        })}
      </Stagger>

      <Reveal>
        <p className="mt-6 text-sm text-muted-foreground">
          Yield comes from idle balances only, placed in vetted, riba-free strategies — never from
          fees on your gift.
        </p>
      </Reveal>
    </Section>
  );
}

function StepIcon({ icon }: { icon: Step["icon"] }) {
  const p = {
    viewBox: "0 0 24 24",
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<Step["icon"], ReactNode> = {
    // hand holding a heart
    donate: (
      <>
        <path d="M3 13a2 2 0 0 1 2-2h3l2.3 1.5a2 2 0 0 0 2.2 0L17 9a1.6 1.6 0 1 1 2 2.5l-5 4a3 3 0 0 1-3 .5l-3-1" />
        <path d="M14.5 3.3a2 2 0 0 0-2.5.4l-.5.5-.5-.5A2 2 0 1 0 8 7l3.5 3 3.5-3a2 2 0 0 0-.5-3.7Z" />
      </>
    ),
    // stacked pool / layers
    pool: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </>
    ),
    // vault / safe
    vault: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 8.5v1M12 14.5v1M15.5 12h-1M9.5 12h-1" />
      </>
    ),
    // trending up
    grow: (
      <>
        <path d="m3 17 6-6 4 4 7-7" />
        <path d="M17 7h4v4" />
      </>
    ),
    // release / unlock
    release: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 7.5-1.9" />
      </>
    ),
    // delivered / check
    delivered: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
  };
  return <svg {...p}>{paths[icon]}</svg>;
}
