import Image from "next/image";
import { CauseIcon } from "@amanah/ui/cause-icon";
import type { CampaignType } from "@amanah/shared";
import { fundingViewFromUsd } from "@/lib/funding";
import { FundingProgress } from "@/components/FundingProgress";
import { CauseTag } from "@/components/CauseTag";
import { OverlayBadge } from "@/components/OverlayBadge";

// Static, presentational "more causes on Amanah" showcase. The cards are non-interactive
// (no donate link) and communicate the breadth of causes/disasters the same engine powers.
// `type` drives styling only via the enum-keyed causeBadgeClass allowlist, never
// interpolated into a className. Mirrors the live card layout (floating cause/location/
// release tags over the cover, funding line below) — but the raised/goal figures here are
// ILLUSTRATIVE (see the footnote), not on-chain, because there is no real campaign behind them.
type Example = {
  type: CampaignType; // hardcoded literals — held to the enum so a typo won't compile
  title: string;
  blurb: string;
  release: "MILESTONE" | "PARAMETRIC";
  country: string; // ISO-3166 alpha-2 code (matches the live cards' country tag)
  image?: string; // optional same-origin cover path (apps/web/public); omit → text-only card
  raisedUsd: number; // illustrative
  goalUsd: number; // illustrative
};

const CAUSES: Example[] = [
  {
    type: "education",
    title: "School supplies for rural students",
    blurb: "Tranches release as enrolment and attendance milestones are verified.",
    release: "MILESTONE",
    country: "ID",
    image: "/showcase/school-supplies.jpg",
    raisedUsd: 17_400,
    goalUsd: 25_000,
  },
  {
    type: "medical",
    title: "Essential medicine for a community clinic",
    blurb: "Funds unlock against delivery and dispensing milestones.",
    release: "MILESTONE",
    country: "ID",
    image: "/showcase/clinic-medicine.jpg",
    raisedUsd: 33_100,
    goalUsd: 40_000,
  },
  {
    type: "waqf",
    title: "Masjid waqf endowment",
    blurb: "A perpetual endowment; idle principal earns halal yield for the cause.",
    release: "MILESTONE",
    country: "ID",
    image: "/showcase/masjid-waqf.jpg",
    raisedUsd: 56_480,
    goalUsd: 75_000,
  },
];

const DISASTERS: Example[] = [
  {
    type: "disaster",
    title: "Mekong Delta flood response",
    blurb: "Parametric release auto-triggers when flood thresholds are breached.",
    release: "PARAMETRIC",
    country: "VN",
    image: "/showcase/mekong-flood.jpg",
    raisedUsd: 20_850,
    goalUsd: 30_000,
  },
  {
    type: "disaster",
    title: "Cyclone relief, Ayeyarwady",
    blurb: "Humanitarian aid that releases on a verified cyclone trigger.",
    release: "PARAMETRIC",
    country: "MM",
    image: "/showcase/cyclone-ayeyarwady.jpg",
    raisedUsd: 48_900,
    goalUsd: 60_000,
  },
];

function ExampleCard({ e }: { e: Example }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {e.image ? (
          <Image
            src={e.image}
            alt="" // decorative: the title already names the example
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <CauseIcon cause={e.type} className="size-10 opacity-40" />
          </div>
        )}
        <CauseTag type={e.type} className="absolute left-3 top-3" />
        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
          <OverlayBadge>{e.country}</OverlayBadge>
          <OverlayBadge className="capitalize">{e.release.toLowerCase()}</OverlayBadge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-serif text-lg leading-snug tracking-tight text-foreground">
            {e.title}
          </h3>
          <p className="line-clamp-2 text-sm text-foreground-soft">{e.blurb}</p>
        </div>
        <div className="mt-auto">
          <FundingProgress view={fundingViewFromUsd(e.raisedUsd, e.goalUsd)} />
        </div>
      </div>
    </div>
  );
}

// One platform, many causes — the same release engine (parametric + milestone),
// AI off-ramp routing, and idle-yield behind every example below.
export function SameEngineShowcase() {
  return (
    <section className="flex flex-col gap-6 border-t border-border pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-2xl tracking-tight text-foreground md:text-3xl">
          More causes on Amanah
        </h2>
        <p className="text-sm text-foreground-soft">
          The same release engine (parametric + milestone), AI off-ramp routing, and
          idle-yield power every cause and disaster on the platform.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground-soft">Other causes</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAUSES.map((e) => (
            <ExampleCard key={e.title} e={e} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground-soft">Other disasters</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DISASTERS.map((e) => (
            <ExampleCard key={e.title} e={e} />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Illustrative examples — amounts shown here are for demonstration. Explore the live
        campaigns above for real, on-chain figures.
      </p>
    </section>
  );
}
