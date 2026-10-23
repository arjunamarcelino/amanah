import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { Badge } from "@amanah/ui/badge";
import { cn } from "@amanah/ui/lib/utils";
import { causeBadgeClass } from "@/lib/campaigns";

// Static, presentational-only "same engine, any cause" showcase. These are illustrative
// EXAMPLES — not live, donatable campaigns — so the cards are non-interactive and each
// carries an explicit "Example" label (glass-box honesty: nothing here implies a real
// on-chain campaign). `type` drives styling only via the enum-keyed causeBadgeClass
// allowlist, never interpolated into a className.
type Example = {
  type: string; // CampaignType for badge styling
  label: string; // human cause label
  title: string;
  blurb: string;
  release: "MILESTONE" | "PARAMETRIC";
  region: string;
};

const CAUSES: Example[] = [
  {
    type: "education",
    label: "education",
    title: "School supplies for rural students",
    blurb: "Tranches release as enrolment and attendance milestones are verified.",
    release: "MILESTONE",
    region: "Indonesia",
  },
  {
    type: "medical",
    label: "medical",
    title: "Essential medicine for a community clinic",
    blurb: "Funds unlock against delivery and dispensing milestones.",
    release: "MILESTONE",
    region: "Indonesia",
  },
  {
    type: "waqf",
    label: "waqf",
    title: "Masjid waqf endowment",
    blurb: "A perpetual endowment; idle principal earns halal yield for the cause.",
    release: "MILESTONE",
    region: "Indonesia",
  },
];

const DISASTERS: Example[] = [
  {
    type: "disaster",
    label: "disaster",
    title: "Mekong Delta flood response",
    blurb: "Parametric release auto-triggers when flood thresholds are breached.",
    release: "PARAMETRIC",
    region: "Vietnam",
  },
  {
    type: "disaster",
    label: "disaster",
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
            {e.label}
          </Badge>
          <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wide">
            Example
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
        <h2 className="text-2xl">Same engine, any cause</h2>
        <p className="text-sm text-foreground-soft">
          Parametric and milestone release, AI off-ramp routing, and idle-yield power every
          cause — these are illustrative examples, not live campaigns.
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
