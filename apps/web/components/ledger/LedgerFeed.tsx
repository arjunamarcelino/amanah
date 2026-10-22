"use client";

import { useQuery } from "@tanstack/react-query";
import type { LedgerEntry } from "@amanah/shared";
import { getLedger } from "@/lib/api";
import { fetchChainEvents, mergeLedger, ledgerKey } from "@/lib/ledger";
import { LedgerRow } from "./LedgerRow";

const POLL_MS = 12_000;
const MAX_ROWS = 100; // cap the rendered feed so a long-open tab doesn't grow the DOM unbounded

function SourceDot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-primary" : "bg-destructive/70"}`} />
      {label} {ok ? "healthy" : "degraded"}
    </span>
  );
}

export function LedgerFeed() {
  // Two independent sources. If one errors we still render the other (labeled), never
  // silently drop events — a blockchain "verify" page must be honest about gaps.
  const apiQuery = useQuery({
    queryKey: ["ledger", "api"],
    queryFn: () => getLedger(100),
    refetchInterval: POLL_MS,
    retry: 1, // root client defaults to 3; avoid hammering the public RPC/API on a blip
  });
  const chainQuery = useQuery({
    queryKey: ["ledger", "chain"],
    queryFn: () => fetchChainEvents(),
    refetchInterval: POLL_MS,
    retry: 1,
  });

  const api: LedgerEntry[] = apiQuery.data ?? [];
  const chain: LedgerEntry[] = chainQuery.data ?? [];
  const rows = mergeLedger(api, chain).slice(0, MAX_ROWS);

  const loading = apiQuery.isLoading && chainQuery.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <SourceDot label="Index (API)" ok={!apiQuery.isError} />
        <SourceDot label="Chain (RPC)" ok={!chainQuery.isError} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading the ledger…</p>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-serif text-2xl text-foreground">Nothing to verify yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-foreground-soft">
            This ledger writes itself from on-chain events. An empty page means nothing has moved
            on-chain — by design, there is nothing we could hide.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((entry) => (
            <LedgerRow key={ledgerKey(entry)} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
