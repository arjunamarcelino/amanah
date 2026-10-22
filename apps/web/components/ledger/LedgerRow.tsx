import type { LedgerEntry } from "@amanah/shared";
import { txUrl } from "@amanah/shared";
import { Badge } from "@amanah/ui/badge";
import { ledgerDisplayAmount } from "@/lib/ledger";

// Enum-keyed allowlist: complete literal class strings looked up by eventName — the
// free-text eventName is NEVER interpolated into a className. Brick (destructive) is
// reserved for TriggerFired (the one event that should grab the eye).
const EVENT_BADGE: Record<string, { label: string; className: string }> = {
  Donated: { label: "Donated", className: "bg-secondary text-secondary-foreground" },
  Invested: { label: "Invested", className: "bg-accent text-accent-foreground" },
  YieldAccrued: { label: "Yield accrued", className: "bg-primary text-primary-foreground" },
  SukukYieldAccrued: { label: "Sukuk yield", className: "bg-primary text-primary-foreground" },
  TriggerFired: { label: "Trigger fired", className: "bg-destructive text-destructive-foreground" },
  MilestoneApproved: { label: "Milestone approved", className: "bg-accent text-accent-foreground" },
  TrancheReleased: { label: "Tranche released", className: "border border-primary text-primary" },
  Routed: { label: "Routed", className: "border border-input text-foreground" },
  PayoutPending: { label: "Payout pending", className: "bg-muted text-muted-foreground" },
};

function badgeFor(eventName: string): { label: string; className: string } {
  return EVENT_BADGE[eventName] ?? { label: eventName, className: "bg-muted text-muted-foreground" };
}

/** Narrow an untrusted payload value to a display string (text child only). */
function text(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const badge = badgeFor(entry.eventName);
  const amount = ledgerDisplayAmount(entry);
  const rail = text(entry.payload, "rail");
  const rationale = text(entry.payload, "rationale");
  const detail = text(entry.payload, "detail");
  const verified = Boolean(entry.txHash);

  return (
    <li className="relative grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-l border-border py-3 pl-6">
      <span className="absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />

      <div className="col-span-2 flex flex-wrap items-center gap-2">
        <Badge className={`border-transparent ${badge.className}`}>{badge.label}</Badge>
        {entry.campaignName && (
          <span className="text-xs text-foreground-soft">{entry.campaignName}</span>
        )}
        {rail && <span className="text-xs text-foreground-soft">via {rail}</span>}
        {verified ? (
          <a
            href={txUrl(entry.txHash as string)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-primary underline-offset-4 hover:underline"
          >
            Verify ↗
          </a>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">unconfirmed</span>
        )}
      </div>

      {amount && (
        <p className="col-span-2 text-lg tabular-nums text-foreground">{amount} USDC</p>
      )}
      {(rationale || detail) && (
        <p className="col-span-2 max-w-prose font-serif text-sm italic text-foreground-soft">
          {rationale ?? detail}
        </p>
      )}
    </li>
  );
}
