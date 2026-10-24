import { txUrl, TxHashSchema, type LedgerEntry } from "@amanah/shared";
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
  TrancheReleased: { label: "Tranche released", className: "bg-accent text-accent-foreground" },
  Routed: { label: "Routed", className: "bg-secondary text-secondary-foreground" },
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

/** A compact timestamp when the row carries one, else its block number, else null. */
function timeLabel(entry: LedgerEntry): string | null {
  if (entry.createdAt) {
    const d = new Date(entry.createdAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  return entry.blockNumber ? `Block ${entry.blockNumber}` : null;
}

export function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const badge = badgeFor(entry.eventName);
  const amount = ledgerDisplayAmount(entry);
  const rail = text(entry.payload, "rail");
  const rationale = text(entry.payload, "rationale");
  const detail = text(entry.payload, "detail");
  const when = timeLabel(entry);
  // Only treat a row as on-chain-verified when its txHash is a real 32-byte hash. The API
  // feed is unauthenticated, so a forged row with a junk txHash must render as unconfirmed,
  // never with a green "Verify" link — the whole page's value is honest verifiability.
  const txHash =
    entry.txHash && TxHashSchema.safeParse(entry.txHash).success ? entry.txHash : null;

  return (
    <li className="relative border-l border-border py-4 pl-6 last:border-l-transparent">
      <span className="absolute -left-[5px] top-[1.3rem] h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" aria-hidden />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`border-transparent ${badge.className}`}>{badge.label}</Badge>
          {entry.campaignName && (
            <span className="text-sm text-foreground-soft">{entry.campaignName}</span>
          )}
          {rail && <span className="text-xs text-foreground-soft">via {rail}</span>}
        </div>

        {amount && (
          <p className="text-xl tabular-nums text-foreground">
            {amount} <span className="text-sm text-foreground-soft">USDC</span>
          </p>
        )}

        {(rationale || detail) && (
          <p className="max-w-prose font-serif text-sm italic text-foreground-soft">
            {rationale ?? detail}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {when ? <span className="tabular-nums">{when}</span> : null}
          {txHash ? (
            <a
              href={txUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Verify ↗
            </a>
          ) : (
            <span>unconfirmed</span>
          )}
        </div>
      </div>
    </li>
  );
}
