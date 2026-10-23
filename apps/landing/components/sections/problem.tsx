import { Section } from "@/components/section";
import { Stagger } from "@/components/stagger";
import { Eyebrow } from "@/components/eyebrow";
import { SectionHeading } from "@/components/section-heading";
import { FeeBar } from "@/components/fee-bar";

export function Problem() {
  return (
    <Section id="problem" labelledBy="problem-title" divider={false}>
      <Stagger step={90}>
        <Eyebrow>The problem</Eyebrow>

        <SectionHeading id="problem-title" className="mt-5 max-w-[20ch]">
          Too much good money disappears in the middle.
        </SectionHeading>

        <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-foreground-soft">
          Between your gift and the people who need it, too much vanishes — to{" "}
          <em className="font-serif not-italic text-foreground">fees, delays, and steps</em>{" "}
          no one outside can see.
        </p>

        <div className="mt-12">
          <FeeBar />
        </div>
      </Stagger>
    </Section>
  );
}
