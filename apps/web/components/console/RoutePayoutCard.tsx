"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import {
  PayoutRouterAbi,
  ADDRESSES,
  CHAIN_ID,
  type RailResponse,
  type RouteResponse,
} from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { TxStatus } from "@/components/TxStatus";
import { RouterAnimation } from "./RouterAnimation";
import { useOwnerWrite } from "@/lib/console/useOwnerWrite";
import { useConsoleSession } from "@/lib/console/session";
import { getRails, postPayout } from "@/lib/api";
import { postRoute } from "@/lib/agent";
import { txUrl } from "@amanah/shared";

const ROUTER = ADDRESSES[CHAIN_ID].PayoutRouter;
const MIN_THINKING_MS = 700;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "idle" | "thinking" | "decided" | "fallback";

// The AI-router step: fetch candidate rails → ask the agent (via the same-origin proxy) →
// animate the decision → recordAndPay the ACTUAL released values from the session → log it.
// Enabled only once a tranche is released (session.pendingPayout === "ready").
export function RoutePayoutCard({
  country,
  accruedYield,
  onRouted,
}: {
  country: string | undefined;
  accruedYield: bigint | undefined;
  onRouted?: () => void;
}) {
  const session = useConsoleSession();
  const { run, writeContractAsync, phase: txPhase, error: txError, txHash, pending } = useOwnerWrite();
  const [phase, setPhase] = useState<Phase>("idle");
  const [candidates, setCandidates] = useState<RailResponse[]>([]);
  const [chosen, setChosen] = useState<RouteResponse | undefined>();
  const [routeError, setRouteError] = useState<string | null>(null);

  const payout = session.pendingPayout;
  const ready = payout.status === "ready";

  // Fee is covered when accrued yield ≥ the fee amount on this payout (else "platform-covered").
  const feeAmount =
    chosen && ready ? (payout.usdcAmount * BigInt(chosen.feeBps)) / 10_000n : undefined;
  const accruedCoversFee =
    feeAmount !== undefined && accruedYield !== undefined ? accruedYield >= feeAmount : false;

  async function onRoute() {
    if (payout.status !== "ready") return;
    if (!country) {
      setRouteError("No country configured for this campaign.");
      return;
    }
    setRouteError(null);
    setChosen(undefined);
    setPhase("thinking");
    try {
      const rails = await getRails(country);
      setCandidates(rails);
      const amountUsd = Number(formatUnits(payout.usdcAmount, 6));
      const [resp] = await Promise.all([
        postRoute({ amountUsd, country, candidates: rails }),
        delay(MIN_THINKING_MS), // keep the "thinking" beat visible even on a fast response
      ]);
      setChosen(resp);
      setPhase(resp.fallbackUsed ? "fallback" : "decided");

      // Re-derive feeBps from the matched candidate (don't trust the round-tripped number).
      const matched = rails.find((r) => r.name === resp.chosenRail || r.id === resp.chosenRail);
      const feeBps = matched?.feeBps ?? resp.feeBps;

      const res = await run(
        () =>
          writeContractAsync({
            address: ROUTER,
            abi: PayoutRouterAbi,
            functionName: "recordAndPay",
            args: [
              payout.payoutId,
              payout.beneficiary,
              payout.usdcAmount,
              resp.chosenRail,
              feeBps,
              resp.rationale,
            ],
            chainId: CHAIN_ID,
          }),
        "Record & pay failed — payout args must match the released tranche.",
      );
      if (!res) return;

      await postPayout({
        payoutId: payout.payoutId,
        campaignId: payout.campaignId,
        beneficiary: payout.beneficiary,
        usdcAmount: payout.usdcAmount.toString(),
        rail: resp.chosenRail,
        feeBpsCovered: feeBps,
        rationale: resp.rationale,
        fallbackUsed: resp.fallbackUsed,
      });
      session.setRouted(res.hash);
      onRouted?.();
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : "Routing failed");
      setPhase("idle");
    }
  }

  const routed = payout.status === "routed";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Route payout</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {phase !== "idle" && (
          <RouterAnimation
            candidates={candidates}
            phase={phase}
            chosen={chosen}
            accruedCoversFee={accruedCoversFee}
          />
        )}

        {routed ? (
          <p className="text-sm text-primary">
            Paid.{" "}
            {payout.status === "routed" && (
              <a
                href={txUrl(payout.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                View on Basescan ↗
              </a>
            )}
          </p>
        ) : (
          <Button
            className="w-fit"
            disabled={!ready || pending || phase === "thinking"}
            onClick={onRoute}
          >
            {phase === "thinking" ? "Routing…" : "Route payout"}
          </Button>
        )}

        {!ready && !routed && (
          <p className="text-xs text-muted-foreground">
            Release a tranche first — routing uses the released payout.
          </p>
        )}
        {routeError && <p className="text-sm text-destructive">{routeError}</p>}
        <TxStatus phase={txPhase} error={txError} txHash={txHash} pendingLabel="Disbursing…" />
      </CardContent>
    </Card>
  );
}
