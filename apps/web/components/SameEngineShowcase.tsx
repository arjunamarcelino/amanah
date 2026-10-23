import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { Badge } from "@amanah/ui/badge";
import { cn } from "@amanah/ui/lib/utils";
import type { CampaignType } from "@amanah/shared";
import { causeBadgeClass } from "@/lib/campaigns";

// Static, presentational "more causes on Amanah" showcase. The cards are non-interactive
// (no donate link) and communicate the breadth of causes/disasters the same engine powers.
// `type` drives styling only via the enum-keyed causeBadgeClass allowlist, never
// interpolated into a className.
type Example = {
  type: CampaignType; // hardcoded literals — held to the enum so a typo won't compile
  title: string;
  blurb: string;
  release: "MILESTONE" | "PARAMETRIC";
  region: string;
};

const CAUSES: Example[] = [
  {
    type: "education",
    title: "School supplies for rural students",
    blurb: "Tranches release as enrolment and attendance milestones are verified.",
    release: "MILESTONE",
    region: "Indonesia",
  },
  {
    type: "medical",
    title: "Essential medicine for a community clinic",
    blurb: "Funds unlock against delivery and dispensing milestones.",
    release: "MILESTONE",
    region: "Indonesia",
  },
  {
    type: "waqf",
    title: "Masjid waqf endowment",
    blurb: "A perpetual endowment; idle principal earns halal yield for the cause.",
    release: "MILESTONE",
    region: "Indonesia",
  },
];

const DISASTERS: Example[] = [
  {
    type: "disaster",
    title: "Mekong Delta flood response",
    blurb: "Parametric release auto-triggers when flood thresholds are breached.",
    release: "PARAMETRIC",
    region: "Vietnam",
  },
  {
    type: "disaster",
    title: "Cyclone relief, Ayeyarwady",
    blurb: "Humanitarian aid that releases on a verified cyclone trigger.",
    release: "PARAMETRIC",
    region: "Myanmar",
  },
];

function ExampleCard({ e }: { e: Example }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge className={cn("border-transparent capitalize", causeBadgeClass(e.type))}>
            {e.type}
          </Badge>
        </div>
        <CardTitle className="text-lg">{e.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <p className="line-clamp-2 text-sm text-foreground-soft">{e.blurb}</p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-foreground-soft">{e.region}</span>
          <Badge variant="outline" className="capitalize">
            {e.release.toLowerCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// One platform, many causes — the same release engine (parametric + milestone),
// AI off-ramp routing, and idle-yield behind every example below.
export function SameEngineShowcase() {
  return (
    <section className="flex flex-col gap-6 border-t border-border pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl">More causes on Amanah</h2>
        <p className="text-sm text-foreground-soft">
          The same release engine (parametric + milestone), AI off-ramp routing, and
          idle-yield power every cause and disaster on the platform.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground-soft">Other causes</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAUSES.map((e) => (
            <ExampleCard key={e.title} e={e} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground-soft">Other disasters</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISASTERS.map((e) => (
            <ExampleCard key={e.title} e={e} />
          ))}
        </div>
      </div>
    </section>
  );
}
