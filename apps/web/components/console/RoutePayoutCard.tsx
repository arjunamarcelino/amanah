"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import {
  PayoutRouterAbi,
  ADDRESSES,
  CHAIN_ID,
  txUrl,
  type RailResponse,
  type RouteResponse,
} from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { TxStatus } from "@/components/TxStatus";
import { RouterAnimation } from "./RouterAnimation";
import type { RouterPhase } from "./routerTypes";
import { useOwnerWrite } from "@/lib/console/useOwnerWrite";
import { useConsoleSession } from "@/lib/console/session";
import { getRails, postPayout } from "@/lib/api";
import { postRoute } from "@/lib/agent";
import { findChosenRail, lowestFeeRail } from "@/lib/console/railMatch";
import { sleep } from "@/lib/sleep";

const ROUTER = ADDRESSES[CHAIN_ID].PayoutRouter;
const MIN_THINKING_MS = 700;

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
  const [phase, setPhase] = useState<RouterPhase>("idle");
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
      // Non-authoritative agent context only (the on-chain pay uses the usdcAmount bigint);
      // precision-safe because RouteRequestSchema caps amountUsd at 1e9.
      const amountUsd = Number(formatUnits(payout.usdcAmount, 6));
      const [resp] = await Promise.all([
        postRoute({ amountUsd, country, candidates: rails }),
        sleep(MIN_THINKING_MS), // keep the "thinking" beat visible even on a fast response
      ]);

      // Constrain the recorded rail to an OFFERED candidate: match by name/id, else fall
      // back to the lowest-fee candidate. Never stamp an unverifiable free-text rail from
      // the agent onto the chain or the public ledger. feeBps also comes from the candidate.
      const matched = findChosenRail(rails, resp.chosenRail) ?? lowestFeeRail(rails);
      if (!matched) {
        setRouteError("No eligible rail to route to.");
        setPhase("idle");
        return;
      }
      const chosenResp: RouteResponse = { ...resp, chosenRail: matched.name, feeBps: matched.feeBps };
      setChosen(chosenResp);
      setPhase(chosenResp.fallbackUsed ? "fallback" : "decided");

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
              chosenResp.chosenRail,
              chosenResp.feeBps,
              chosenResp.rationale,
            ],
            chainId: CHAIN_ID,
          }),
        "Record & pay failed — payout args must match the released tranche.",
      );
      if (!res) {
        setPhase("idle"); // don't leave a success-looking "decided" state on a reverted pay
        return;
      }

      await postPayout({
        payoutId: payout.payoutId,
        campaignId: payout.campaignId,
        beneficiary: payout.beneficiary,
        usdcAmount: payout.usdcAmount.toString(),
        rail: chosenResp.chosenRail,
        feeBpsCovered: chosenResp.feeBps,
        rationale: chosenResp.rationale,
        fallbackUsed: chosenResp.fallbackUsed,
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
    <Card className="rounded-2xl shadow-sm">
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
        {/* Hidden once routed — the "Paid · View on Basescan" line above already links the tx. */}
        {!routed && (
          <TxStatus phase={txPhase} error={txError} txHash={txHash} pendingLabel="Disbursing…" />
        )}
      </CardContent>
    </Card>
  );
}
