"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { CampaignResponse, LedgerEntry } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { cn } from "@amanah/ui/lib/utils";
import { getCampaigns, getLedger } from "@/lib/api";
import {
  coverImageFor,
  findCampaignByParam,
  isFeatured,
  visibleCampaigns,
} from "@/lib/campaigns";
import { fundingView, usd } from "@/lib/funding";
import { storyFor } from "@/lib/story";
import { FundingProgress } from "@/components/FundingProgress";
import { CauseTag } from "@/components/CauseTag";
import { CampaignCard } from "@/components/CampaignCard";

// GoFundMe-style fundraiser page. Cards link here (not straight to /donate); the sidebar's
// "Donate now" button is the redirect into the donate flow. Layout: hero → [story | sticky
// donate card] → trust section (the card unsticks here) → "More ways" (other campaigns).
export function CampaignDetail({ param }: { param: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => getCampaigns(),
  });

  const campaign = useMemo(
    () => (data ? findCampaignByParam(data, param) : undefined),
    [data, param],
  );
  const others = useMemo(
    () =>
      data
        ? visibleCampaigns(data).filter((c) => c.campaignId !== campaign?.campaignId)
        : [],
    [data, campaign],
  );

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="aspect-[16/9] w-full animate-pulse rounded-2xl bg-card" />
      </main>
    );
  }

  if (isError) {
    return (
      <Centered>
        <p className="text-foreground-soft">Couldn&apos;t load this campaign.</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </Centered>
    );
  }

  if (!campaign || !campaign.active) {
    return (
      <Centered>
        <h1 className="font-serif text-2xl">Campaign not found</h1>
        <Button asChild variant="outline">
          <Link href="/">Browse campaigns</Link>
        </Button>
      </Centered>
    );
  }

  const cover = coverImageFor(campaign);
  const story = storyFor(campaign);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 md:py-10">
      <div className="flex flex-col gap-5">
        <Link
          href="/"
          className="w-fit text-sm text-foreground-soft underline underline-offset-4 hover:no-underline"
        >
          ← Back to campaigns
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <CauseTag type={campaign.type} />
          {campaign.country ? <MetaPill>{campaign.country}</MetaPill> : null}
          <MetaPill className="capitalize">{campaign.releaseType.toLowerCase()}</MetaPill>
          {isFeatured(campaign) ? <MetaPill>Featured</MetaPill> : null}
        </div>

        <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
          {campaign.name ?? campaign.cause}
        </h1>

        {/* Flex parent so the aspect-ratio cover (fill image) resolves its height. */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="object-cover"
            />
          ) : null}
        </div>
      </div>

      {/* Story (left) + sticky donate card (right). */}
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <article className="flex flex-col gap-8 lg:order-none">
          {campaign.recipientOrg ? (
            <p className="text-sm text-foreground-soft">
              Organized by{" "}
              <span className="font-medium text-foreground">{campaign.recipientOrg}</span>
            </p>
          ) : null}

          <div className="flex flex-col gap-4 leading-relaxed text-foreground">
            {story.map((p, i) => (
              <p key={i} className="text-[0.975rem] text-foreground-soft">
                {p}
              </p>
            ))}
          </div>

          <DonationsList campaignId={campaign.campaignId} />
        </article>

        <aside className="order-first lg:sticky lg:top-[5.5rem] lg:order-none lg:self-start">
          <DonateCard campaign={campaign} />
        </aside>
      </div>

      <TrustSection />

      {others.length > 0 ? <MoreWays campaigns={others} /> : null}
    </main>
  );
}

function DonateCard({ campaign }: { campaign: CampaignResponse }) {
  const funding = fundingView(campaign.baseRaised, campaign.goalBase);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <p className="font-serif text-2xl text-foreground">
          {funding.raisedLabel}{" "}
          <span className="text-base font-normal text-foreground-soft">raised</span>
        </p>
        {funding.goalLabel ? (
          <p className="text-sm text-foreground-soft">
            {funding.pct !== null ? `${Math.round(funding.pct)}% of ` : "of "}
            {funding.goalLabel} goal
          </p>
        ) : null}
      </div>

      <FundingProgress view={funding} />

      <Button asChild size="lg" className="w-full rounded-full font-semibold">
        <Link href={`/donate/${campaign.campaignId}`}>Donate now</Link>
      </Button>
      <ShareButton />
    </div>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — no-op.
    }
  }
  return (
    <Button variant="outline" size="lg" className="w-full rounded-full font-semibold" onClick={share}>
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}

function DonationsList({ campaignId }: { campaignId: string }) {
  const { data } = useQuery({ queryKey: ["ledger"], queryFn: () => getLedger() });

  const donations = useMemo(
    () =>
      (data ?? []).filter(
        (e): e is LedgerEntry =>
          e.kind === "donation" &&
          e.status === "confirmed" &&
          (e.campaignId ?? "").toLowerCase() === campaignId.toLowerCase(),
      ),
    [data, campaignId],
  );

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="font-serif text-xl tracking-tight text-foreground">
        Recent donations
        {donations.length > 0 ? (
          <span className="ml-2 text-sm font-normal text-foreground-soft">
            {donations.length}
          </span>
        ) : null}
      </h2>
      {donations.length === 0 ? (
        <p className="text-sm text-foreground-soft">
          No donations yet — be the first to support this campaign.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {donations.slice(0, 8).map((d) => (
            <li key={`${d.txHash}-${d.logIndex}`} className="flex items-center justify-between gap-3 py-2.5">
              <span className="font-mono text-sm text-foreground">{shortDonor(d)}</span>
              <span className="text-sm font-medium text-foreground">{donationUsd(d)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrustSection() {
  const points = [
    {
      title: "Every gift on-chain",
      body: "See exactly where your money goes. Every movement is a public event on Base you can verify yourself on the ledger.",
    },
    {
      title: "Near-zero fees",
      body: "No middlemen skimming your donation. Almost all of it reaches the cause, routed the cheapest way by the off-ramp agent.",
    },
    {
      title: "Funds that work while they wait",
      body: "Idle principal earns halal, riba-free yield for the cause — so waiting funds still do good before they're delivered.",
    },
    {
      title: "Released when it's needed",
      body: "Parametric and milestone triggers release funds on verified conditions — no committee, no delay, no diversion.",
    },
  ];
  return (
    <section className="flex flex-col gap-8 rounded-3xl border border-border bg-card/60 p-8 md:p-10">
      <div className="max-w-2xl">
        <h2 className="font-serif text-2xl leading-tight tracking-tight text-foreground md:text-3xl">
          Your transparent, powerful, and trusted home for giving.
        </h2>
        <p className="mt-2 text-foreground-soft">
          Amanah turns every donation into an auditable, on-chain gift — built so you can trust
          exactly where your generosity goes.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="flex flex-col gap-1.5">
            <h3 className="font-medium text-foreground">{p.title}</h3>
            <p className="text-sm text-foreground-soft">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MoreWays({ campaigns }: { campaigns: CampaignResponse[] }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-2xl tracking-tight text-foreground md:text-3xl">
          More ways to make a difference
        </h2>
        <p className="text-foreground-soft">
          Find fundraisers inspired by what you care about.
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Happening worldwide
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => (
          <CampaignCard key={c.campaignId} campaign={c} />
        ))}
      </div>
    </section>
  );
}

/* ── small helpers ─────────────────────────────────────────────────────────── */

function MetaPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {children}
    </main>
  );
}

function shortDonor(d: LedgerEntry): string {
  const donor = typeof d.payload.donor === "string" ? d.payload.donor : "";
  return donor ? `${donor.slice(0, 6)}…${donor.slice(-4)}` : "Anonymous";
}

function donationUsd(d: LedgerEntry): string {
  const base = typeof d.payload.baseOut === "string" ? d.payload.baseOut : "0";
  try {
    return usd(Number(BigInt(base) / 1_000_000n));
  } catch {
    return "$0";
  }
}
