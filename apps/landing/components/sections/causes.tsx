import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";
import { Card, CardContent } from "@amanah/ui/card";
import { cn } from "@amanah/ui/lib/utils";

type Cause = {
  emoji: string;
  label: string;
  description: string;
  featured?: boolean;
};

const causes: Cause[] = [
  {
    emoji: "⚡",
    label: "Disaster relief",
    description:
      "Get funds to the ground in hours, not weeks, when a crisis hits — the router finds the fastest path so help lands while it still matters.",
    featured: true,
  },
  {
    emoji: "🎓",
    label: "Education",
    description: "Fund schools, scholarships, and teachers — transparently, end to end.",
  },
  {
    emoji: "⚕",
    label: "Medical",
    description: "Cover treatment and care with every transfer on the public record.",
  },
  {
    emoji: "🏚",
    label: "Poverty",
    description: "Direct support that reaches people without a cut taken along the way.",
  },
  {
    emoji: "🌙",
    label: "Masjid / waqf",
    description: "Sustain a masjid or endowment with optional riba-free handling.",
  },
];

export function Causes() {
  return (
    <Section id="causes" labelledBy="causes-title">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px w-8 bg-border" />
        <span className="text-sm font-medium tracking-wide text-primary">
          Where your giving goes
        </span>
      </div>

      <h2
        id="causes-title"
        className="mt-5 max-w-[20ch] text-[clamp(1.9rem,1.2rem+2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance"
      >
        Give to any cause.
      </h2>

      <p className="mt-4 max-w-[38rem] text-foreground-soft">
        One pool, many causes — disaster relief is where Amanah proves itself first.
      </p>

      <Reveal>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          {causes.map((cause) => {
            const featured = cause.featured ?? false;
            return (
              <Card
                key={cause.label}
                className={cn(
                  "flex min-w-0 flex-col p-6 shadow-none",
                  featured
                    ? "border-border bg-accent md:col-span-2 lg:col-span-2 lg:row-span-2"
                    : "border-border bg-card",
                )}
              >
                <CardContent className="flex min-w-0 flex-1 flex-col p-0">
                  <span
                    aria-hidden="true"
                    className={cn("leading-none", featured ? "text-4xl" : "text-2xl")}
                  >
                    {cause.emoji}
                  </span>
                  <h3
                    className={cn(
                      "mt-4 min-w-0 font-medium text-foreground [overflow-wrap:anywhere]",
                      featured ? "text-xl" : "text-lg",
                    )}
                  >
                    {cause.label}
                  </h3>
                  <p
                    className={cn(
                      "mt-2 min-w-0",
                      featured
                        ? "text-base text-foreground-soft"
                        : "text-sm text-muted-foreground",
                    )}
                  >
                    {cause.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Reveal>
    </Section>
  );
}
