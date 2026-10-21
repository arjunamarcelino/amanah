import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { FeeBar } from "@/components/fee-bar";

export function Problem() {
  return (
    <Section id="problem" labelledBy="problem-title">
      <Reveal>
        <div className="mb-5 flex items-center gap-3">
          <span aria-hidden className="h-px w-6 bg-primary" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            The problem
          </span>
        </div>

        <h2
          id="problem-title"
          className="max-w-[20ch] text-[clamp(1.9rem,1.2rem+2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance"
        >
          Too much good money disappears in the middle.
        </h2>

        <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-foreground-soft">
          Between your wallet and the people who need help,{" "}
          <em className="font-serif not-italic text-foreground">
            too much good money quietly disappears
          </em>{" "}
          — to fees, to delay, and to processes no one on the outside can see.
        </p>

        <div className="mt-12">
          <FeeBar />
        </div>
      </Reveal>
    </Section>
  );
}
