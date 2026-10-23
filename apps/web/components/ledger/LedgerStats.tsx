"use client";

import { useQuery } from "@tanstack/react-query";
import { getCampaigns, getLedger } from "@/lib/api";
import { fetchChainEvents, mergeLedger } from "@/lib/ledger";
import { visibleCampaigns } from "@/lib/campaigns";
import { usd } from "@/lib/funding";

const POLL_MS = 12_000;

function safeBig(s: string): bigint {
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

// Impact summary for the ledger. Real data: total donated is the sum of every campaign's
// confirmed on-chain raised (baseRaised), active campaigns is the visible count, on-chain
// events is the merged feed length, and platform fees are $0 by design. Reuses the same
// cached queries as LedgerFeed (same query keys → react-query dedupes, no extra polling).
export function LedgerStats() {
  const campaignsQ = useQuery({ queryKey: ["campaigns"], queryFn: () => getCampaigns() });
  const apiQ = useQuery({
    queryKey: ["ledger", "api"],
    queryFn: () => getLedger(100),
    refetchInterval: POLL_MS,
    retry: 1,
  });
  const chainQ = useQuery({
    queryKey: ["ledger", "chain"],
    queryFn: () => fetchChainEvents(),
    refetchInterval: POLL_MS,
    retry: 1,
  });

  const active = visibleCampaigns(campaignsQ.data ?? []);
  const totalBase = active.reduce((acc, c) => acc + safeBig(c.baseRaised), 0n);
  const totalUsd = Number(totalBase / 1_000_000n);
  const events = mergeLedger(apiQ.data ?? [], chainQ.data ?? []).length;

  const stats: { label: string; value: string; accent?: boolean }[] = [
    { label: "Total donated", value: usd(totalUsd) },
    { label: "Active campaigns", value: String(active.length) },
    { label: "On-chain events", value: String(events) },
    { label: "Platform fees", value: usd(0), accent: true },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {s.label}
          </dt>
          <dd
            className={
              "font-serif text-2xl tabular-nums tracking-tight md:text-3xl " +
              (s.accent ? "text-primary" : "text-foreground")
            }
          >
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
