"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { campaignIdFromSlug } from "@amanah/shared";
import { getCampaigns } from "@/lib/api";
import { useConsoleSession } from "@/lib/console/session";
import { useCharityPool } from "@/lib/console/useCharityPool";
import { useReleaseController } from "@/lib/console/useReleaseController";
import { deriveOperatorStep, type OperatorStep } from "@/lib/console/operatorStep";
import { presetForSlug } from "@/lib/console/presets";
import { OwnerGate } from "@/components/console/OwnerGate";
import { ConsoleChainGuard } from "@/components/console/ConsoleChainGuard";
import { CampaignSelect } from "@/components/console/CampaignSelect";
import { CampaignStatePanel } from "@/components/console/CampaignStatePanel";
import { OperatorStepper } from "@/components/console/OperatorStepper";
import { YieldTicker } from "@/components/console/YieldTicker";
import { InvestIdleCard } from "@/components/console/InvestIdleCard";
import { AccrueCard } from "@/components/console/AccrueCard";
import { HalalToggle } from "@/components/console/HalalToggle";
import { ReleaseConditionCard } from "@/components/console/ReleaseConditionCard";
import { ReleaseTrancheCard } from "@/components/console/ReleaseTrancheCard";
import { RoutePayoutCard } from "@/components/console/RoutePayoutCard";
import { CompliancePanel } from "@/components/CompliancePanel";

const POLL_MS = 5_000;

function releaseDisabledReason(step: OperatorStep): string | undefined {
  switch (step.step) {
    case "awaiting_donations":
      return "Awaiting donations.";
    case "needs_trigger":
      return "Fire the trigger / approve the milestone first.";
    case "awaiting_unlock":
      return "Time-locked (T+N) — not yet unlocked.";
    case "fully_released":
      return "Fully released.";
    case "can_route":
      return "Tranche released — route the payout below.";
    case "paid":
      return "Payout complete.";
    default:
      return undefined;
  }
}

function ConsoleInner() {
  const session = useConsoleSession();
  const slug = session.selectedSlug;
  const campaignId = slug ? campaignIdFromSlug(slug) : undefined;

  const pool = useCharityPool(campaignId, { refetchIntervalMs: POLL_MS });
  const rc = useReleaseController(campaignId, { refetchIntervalMs: POLL_MS });
  const { data: campaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: () => getCampaigns() });

  const campaign = campaignId
    ? campaigns.find((c) => c.campaignId.toLowerCase() === campaignId.toLowerCase())
    : undefined;
  const preset = slug ? presetForSlug(slug) : null;

  const step = useMemo<OperatorStep>(
    () =>
      deriveOperatorStep({
        donated: pool.donated ?? 0n,
        released: pool.released ?? 0n,
        releaseType: rc.releaseType,
        canRelease: rc.canRelease ?? false,
        activatedAt: rc.activatedAt ?? 0n,
        releaseDelay: pool.releaseDelay ?? 0n,
        now: BigInt(Math.floor(Date.now() / 1000)),
        hasPendingPayout: session.pendingPayout.status === "ready",
        routed: session.pendingPayout.status === "routed",
      }),
    [
      pool.donated,
      pool.released,
      pool.releaseDelay,
      rc.releaseType,
      rc.canRelease,
      rc.activatedAt,
      session.pendingPayout.status,
    ],
  );

  const refetch = () => {
    void pool.refetch();
    void rc.refetch();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Operator · Base Sepolia
        </p>
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
          Operator console
        </h1>
        <p className="max-w-2xl text-foreground-soft">
          Owner-only controls for the treasury and release engine — invest idle funds, accrue
          yield, fire release conditions, release tranches, and route payouts.
        </p>
      </header>

      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <CampaignSelect />
        <YieldTicker value={pool.accruedYield} halalMode={pool.halalMode} />
      </div>

      {!slug || !campaignId ? (
        <p className="text-foreground-soft">Select a campaign to begin.</p>
      ) : (
        <>
          <CampaignStatePanel
            step={step}
            donated={pool.donated}
            released={pool.released}
            accruedYield={pool.accruedYield}
            campaignName={campaign?.name}
          />

          <OperatorStepper step={step} />

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl tracking-tight text-foreground">Treasury</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <InvestIdleCard onSuccess={refetch} />
              <AccrueCard halalMode={pool.halalMode} onSuccess={refetch} />
              <HalalToggle halalMode={pool.halalMode} onSuccess={refetch} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl tracking-tight text-foreground">Release &amp; payout</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <ReleaseConditionCard
                campaignId={campaignId}
                releaseType={rc.releaseType}
                canRelease={rc.canRelease}
                detail={preset?.detail ?? ""}
                onSuccess={refetch}
              />
              <ReleaseTrancheCard
                campaignId={campaignId}
                slug={slug}
                enabled={step.step === "can_release"}
                disabledReason={releaseDisabledReason(step)}
                remainingCap={pool.remainingCap}
                onReleased={refetch}
              />
              <RoutePayoutCard
                country={campaign?.country ?? undefined}
                accruedYield={pool.accruedYield}
                onRouted={refetch}
              />
            </div>
          </section>
        </>
      )}

      <CompliancePanel className="rounded-2xl" />
    </main>
  );
}

export default function ConsolePage() {
  return (
    <OwnerGate>
      <ConsoleChainGuard>
        <ConsoleInner />
      </ConsoleChainGuard>
    </OwnerGate>
  );
}
