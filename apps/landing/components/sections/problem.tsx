import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { Eyebrow } from "@/components/eyebrow";
import { FeeBar } from "@/components/fee-bar";

export function Problem() {
  return (
    <Section id="problem" labelledBy="problem-title" divider={false}>
      <Reveal>
        <Eyebrow>The problem</Eyebrow>

        <h2
          id="problem-title"
          className="mt-5 max-w-[20ch] text-[clamp(1.9rem,1.2rem+2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance"
        >
          Too much good money disappears in the middle.
        </h2>

        <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-foreground-soft">
          Between your gift and the people who need it, too much vanishes — to{" "}
          <em className="font-serif not-italic text-foreground">fees, delays, and steps</em>{" "}
          no one outside can see.
        </p>

        <div className="mt-12">
          <FeeBar />
        </div>
      </Reveal>
    </Section>
  );
}
