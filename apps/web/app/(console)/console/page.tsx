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
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Owner · Base Sepolia</p>
        <h1 className="font-serif text-3xl text-foreground">Operator console</h1>
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
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

          <div className="grid gap-4 md:grid-cols-2">
            <InvestIdleCard onSuccess={refetch} />
            <AccrueCard halalMode={pool.halalMode} onSuccess={refetch} />
            <HalalToggle halalMode={pool.halalMode} onSuccess={refetch} />
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
        </>
      )}

      <CompliancePanel />
    </div>
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
