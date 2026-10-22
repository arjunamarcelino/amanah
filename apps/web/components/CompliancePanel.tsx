import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";

// Static compliance posture — shown on the operator console and the public ledger.
// Pure copy (no live data): irrevocable gift / not-a-CIS, the on-chain policy, the
// beneficiary model, and the production licensing requirement.
const POINTS: { title: string; body: string }[] = [
  {
    title: "Irrevocable gift — not a collective investment scheme",
    body: "Donations are irrevocable and donors receive no financial return, units, or redemption right. There is no pooled profit for contributors, so this is not a CIS.",
  },
  {
    title: "On-chain treasury policy",
    body: "A 20–30% liquidity buffer is held; the remainder is deployed only to low-risk, principal-protective instruments. Releases are staged and time-locked (T+N) behind an explicit release condition.",
  },
  {
    title: "Vetted, communal beneficiaries",
    body: "Funds are released to communal relief efforts and pre-vetted partner organisations — never to individual discretionary accounts.",
  },
  {
    title: "Production requirements",
    body: "A production deployment requires an FRFCP permit to solicit and a licensed charity partner of record. This demo runs on Base Sepolia testnet.",
  },
];

export function CompliancePanel({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-serif">Compliance</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span aria-hidden className="mt-1 text-primary">✓</span>
              <div>
                <p className="font-medium text-foreground">{p.title}</p>
                <p className="text-sm text-foreground-soft">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex items-center gap-2 text-sm text-secondary-foreground">
          <span aria-hidden>🌙</span>
          Halal mode routes yield to sukuk-style, interest-free instruments.
        </p>
      </CardContent>
    </Card>
  );
}
