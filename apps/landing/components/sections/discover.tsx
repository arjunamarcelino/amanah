import type { HTMLAttributes } from "react";
import Image from "next/image";
import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { Stagger } from "@/components/stagger";
import { SectionHeading } from "@/components/section-heading";
import { CountUp } from "@/components/count-up";
import { siteConfig } from "@/lib/site";
import { cn } from "@amanah/ui/lib/utils";

// Example-campaigns showcase (layout mirrors GoFundMe's "discover" block: one featured card on
// the left, a 2×2 grid on the right). Titles/images mirror the app's showcase campaigns; the
// amounts are illustrative. Every card links to the dApp — there are no per-campaign pages on
// the static marketing site.
type Campaign = {
  title: string;
  image: string;
  donations: string;
  /** USD amount raised (illustrative); counts up when the card scrolls in. */
  raised: number;
  progress: number;
};

const FEATURED: Campaign = {
  title: "Cyclone relief, Ayeyarwady",
  image: "/showcase/cyclone-ayeyarwady.jpg",
  donations: "14.2K",
  raised: 512340,
  progress: 82,
};

const GRID: Campaign[] = [
  {
    title: "Essential medicine for a community clinic",
    image: "/showcase/clinic-medicine.jpg",
    donations: "5.4K",
    raised: 331912,
    progress: 88,
  },
  {
    title: "Masjid waqf endowment",
    image: "/showcase/masjid-waqf.jpg",
    donations: "24.6K",
    raised: 564862,
    progress: 95,
  },
  {
    title: "School supplies for rural students",
    image: "/showcase/school-supplies.jpg",
    donations: "2K",
    raised: 174667,
    progress: 66,
  },
  {
    title: "Mekong Delta flood response",
    image: "/showcase/mekong-flood.jpg",
    donations: "6.1K",
    raised: 208500,
    progress: 73,
  },
];

function CampaignCard({
  c,
  featured = false,
  ...rest
}: { c: Campaign; featured?: boolean } & HTMLAttributes<HTMLDivElement>) {
  // The reveal (from <Stagger>) rides on this wrapper so it never fights the inner <a>'s own
  // hover translate; the <a> is h-full so the grid still stretches cards evenly.
  return (
    <div {...rest} className="h-full">
      <a
        href={siteConfig.appUrl}
        className="group flex h-full flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1"
      >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-muted shadow-sm transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-foreground/10",
          featured ? "aspect-[4/3]" : "aspect-[16/10]",
        )}
      >
        <Image
          src={c.image}
          alt=""
          fill
          sizes={
            featured
              ? "(max-width: 1024px) 100vw, 34vw"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 17vw"
          }
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-foreground/80 px-3 py-1 text-xs font-medium text-background backdrop-blur-sm">
          {c.donations} donations
        </span>
      </div>

      <h3
        className={cn(
          "mt-3 font-semibold text-foreground transition-colors group-hover:text-primary",
          featured ? "text-xl" : "text-base",
        )}
      >
        {c.title}
      </h3>

      <div className="mt-auto pt-3">
        <div
          role="progressbar"
          aria-valuenow={c.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${c.title}: $${c.raised.toLocaleString()} raised`}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(144_48%_42%)]"
            style={{ width: `${c.progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-foreground">
          $<CountUp value={c.raised} /> raised
        </p>
      </div>
      </a>
    </div>
  );
}

export function Discover() {
  return (
    <Section id="discover" labelledBy="discover-title" divider={false}>
      <Reveal>
        <SectionHeading id="discover-title" className="max-w-[22ch]">
          Discover causes close to your heart.
        </SectionHeading>
      </Reveal>

      <Stagger step={110} className="mt-10 grid gap-6 lg:grid-cols-2">
        <CampaignCard c={FEATURED} featured />
        <Stagger step={90} className="grid gap-6 sm:grid-cols-2">
          {GRID.map((c) => (
            <CampaignCard key={c.title} c={c} />
          ))}
        </Stagger>
      </Stagger>

      <Reveal>
        <p className="mt-6 text-xs text-muted-foreground">
          Illustrative examples — explore live campaigns in the app.
        </p>
      </Reveal>
    </Section>
  );
}
