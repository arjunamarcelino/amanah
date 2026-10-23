"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import type { CampaignResponse } from "@amanah/shared";
import { buildDonationPayload } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { cn } from "@amanah/ui/lib/utils";
import { getCampaigns, postDonation } from "@/lib/api";
import { asBytes32 } from "@/lib/hex";
import { ZERO_CAMPAIGN_ID, coverImageFor } from "@/lib/campaigns";
import { fundingView } from "@/lib/funding";
import { parseTokenAmount, formatTokenAmount, AMOUNT_ERROR_MESSAGE } from "@/lib/amount";
import { tokenByKey, type StablecoinKey } from "@/lib/tokens";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { useErc20 } from "@/lib/hooks/useErc20";
import { useDonateEngine } from "@/lib/hooks/useDonateEngine";
import { StablecoinSelect } from "@/components/StablecoinSelect";
import { AmountField } from "@/components/AmountField";
import { ConsentBox } from "@/components/ConsentBox";
import { DonateProgressDialog } from "@/components/DonateProgressDialog";
import { FundingProgress } from "@/components/FundingProgress";
import { RequireWallet } from "@/components/RequireWallet";
import { ChainGuard } from "@/components/ChainGuard";
import { GasPrompt } from "@/components/GasPrompt";

// Wallet page — never statically prerendered. The header provides the "Fundraiser" back link,
// so there's no inline back link here.
export const dynamic = "force-dynamic";

// Quick-pick amounts (stablecoins are ~$1 each); "Custom" lives in the amount field below.
const PRESETS = [10, 25, 50, 100, 250];

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-start justify-center gap-3 px-6">
      {children}
    </main>
  );
}

function Blocked({ title }: { title: string }) {
  return (
    <Centered>
      <h1 className="font-serif text-2xl">{title}</h1>
      <Button asChild variant="outline">
        <Link href="/">Browse campaigns</Link>
      </Button>
    </Centered>
  );
}

export default function DonatePage() {
  const params = useParams<{ campaignId: string }>();
  const idParam = typeof params.campaignId === "string" ? params.campaignId : "";
  const validId = asBytes32(idParam); // narrow + validate before any fetch

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => getCampaigns(),
    enabled: validId !== null,
  });

  if (!validId || validId === ZERO_CAMPAIGN_ID) return <Blocked title="Campaign not found" />;
  if (isLoading) {
    return (
      <Centered>
        <p className="text-foreground-soft">Loading campaign…</p>
      </Centered>
    );
  }
  if (isError) {
    return (
      <Centered>
        <p className="text-sm text-foreground-soft">Couldn&apos;t load this campaign.</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </Centered>
    );
  }

  const campaign = (data ?? []).find((c) => c.campaignId.toLowerCase() === validId);
  // Gate BEFORE any wallet interaction — donate() pulls funds for any campaignId and
  // does NOT check registration, so this is a fund-misdirection control (S-2).
  if (!campaign) return <Blocked title="Campaign not found" />;
  if (!campaign.active) return <Blocked title="This campaign is not active" />;
  if (!campaign.registeredOnChain) {
    return <Blocked title="This campaign isn't open for donations yet" />;
  }

  return <DonateExperience campaign={campaign} campaignId={validId} />;
}

function DonateExperience({
  campaign,
  campaignId,
}: {
  campaign: CampaignResponse;
  campaignId: Hex;
}) {
  // Amount + coin live here (above the wallet gate) so the sticky summary reflects them live.
  const [coin, setCoin] = useState<StablecoinKey>("mUSDC");
  const [input, setInput] = useState("");

  const name = campaign.name ?? campaign.cause;
  // Client page (no server metadata), so set the tab title here.
  useEffect(() => {
    document.title = `Donate to ${name} | Amanah`;
  }, [name]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="font-serif text-2xl leading-tight tracking-tight text-foreground md:text-3xl">
        Donate to {name}
      </h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="lg:order-none">
          <RequireWallet>
            <ChainGuard>
              <GasPrompt>
                <DonateForm
                  campaignId={campaignId}
                  coin={coin}
                  setCoin={setCoin}
                  input={input}
                  setInput={setInput}
                />
              </GasPrompt>
            </ChainGuard>
          </RequireWallet>
        </div>

        <aside className="order-first lg:sticky lg:top-[5.5rem] lg:order-none lg:self-start">
          <SummaryCard campaign={campaign} coin={coin} input={input} />
        </aside>
      </div>
    </main>
  );
}

function SummaryCard({
  campaign,
  coin,
  input,
}: {
  campaign: CampaignResponse;
  coin: StablecoinKey;
  input: string;
}) {
  const cover = coverImageFor(campaign);
  const funding = fundingView(campaign.baseRaised, campaign.goalBase);
  const parsed = parseTokenAmount(input);
  const amount = parsed.ok ? Number(input) : 0;
  // No "$": the stablecoin (shown alongside) IS the unit, so "10.00 mUSDC" not "$10.00 mUSDC".
  const amountLabel = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {cover ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
            <Image src={cover} alt="" fill sizes="56px" className="object-cover" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs text-foreground-soft">Your donation supports</p>
          <p className="truncate font-medium text-foreground">
            {campaign.name ?? campaign.cause}
          </p>
        </div>
      </div>

      <FundingProgress view={funding} />

      <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-foreground-soft">Your donation</dt>
          <dd className="font-medium text-foreground">
            {amountLabel} {coin}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-foreground-soft">Platform fee</dt>
          <dd className="font-medium text-primary">0.00 {coin}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-base">
          <dt className="font-semibold text-foreground">Total</dt>
          <dd className="font-semibold text-foreground">
            {amountLabel} {coin}
          </dd>
        </div>
      </dl>

      <p className="rounded-lg bg-accent/60 px-3 py-2 text-xs text-accent-foreground">
        100% goes to the cause. Amanah takes no platform cut — only the network&apos;s near-zero
        gas, and the off-ramp routes payouts the cheapest way.
      </p>
    </div>
  );
}

function DonateForm({
  campaignId,
  coin,
  setCoin,
  input,
  setInput,
}: {
  campaignId: Hex;
  coin: StablecoinKey;
  setCoin: (c: StablecoinKey) => void;
  input: string;
  setInput: (v: string) => void;
}) {
  const { state } = useDonorWallet();
  const owner = state.status === "active" ? state.address : undefined;

  const [consent, setConsent] = useState(false);
  const [ledgerPending, setLedgerPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const token = tokenByKey(coin);
  const { balance, allowance, refetch } = useErc20(token, owner);
  const engine = useDonateEngine();

  const parsed = useMemo(() => parseTokenAmount(input), [input]);
  const amountError = input !== "" && !parsed.ok ? AMOUNT_ERROR_MESSAGE[parsed.error] : null;
  const insufficient = parsed.ok && balance !== undefined && parsed.value > balance;

  // Any change to the gift resets consent so a stale hash can never be submitted (S-1).
  useEffect(() => {
    setConsent(false);
  }, [coin, input]);

  const canDonate =
    parsed.ok &&
    balance !== undefined &&
    !insufficient &&
    consent &&
    Boolean(owner) &&
    !engine.pending;

  async function onDonate() {
    if (!parsed.ok || !owner) return;
    setDialogOpen(true); // open the stepper dialog for the approve → donate → done flow
    const res = await engine.donate({
      campaignId,
      token,
      donor: owner,
      amount: parsed.value,
      currentAllowance: allowance ?? 0n,
    });
    await refetch();
    if (res && res.logIndex !== undefined && res.baseOut !== undefined) {
      setLedgerPending(true);
      const payload = buildDonationPayload({
        txHash: res.txHash,
        logIndex: res.logIndex,
        donor: owner,
        campaignId,
        stablecoin: token,
        amountIn: parsed.value,
        baseOut: res.baseOut,
        consentHash: res.consentHash,
      });
      const outcome = await postDonation(payload);
      setLedgerPending(outcome.kind === "deferred");
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-xl tracking-tight text-foreground">Enter your donation</h2>
        <AmountPresets value={input} onPick={setInput} disabled={engine.pending} />
        <AmountField
          label="Or enter a custom amount"
          value={input}
          onChange={setInput}
          error={amountError ?? (insufficient ? "Amount exceeds your balance" : null)}
          disabled={engine.pending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Pay with</span>
        <StablecoinSelect value={coin} onChange={setCoin} disabled={engine.pending} />
        {balance !== undefined ? (
          <p className="text-xs text-foreground-soft">
            Balance: {formatTokenAmount(balance)} {coin} ·{" "}
            <Link href="/mint" className="text-primary underline underline-offset-4">
              Mint more
            </Link>
          </p>
        ) : null}
      </div>

      <ConsentBox checked={consent} onChange={setConsent} disabled={engine.pending} />

      <Button size="lg" className="w-full rounded-full font-semibold" onClick={onDonate} disabled={!canDonate}>
        {engine.pending ? "Processing…" : parsed.ok ? `Donate ${Number(input).toLocaleString()} ${coin}` : `Donate ${coin}`}
      </Button>

      <DonateProgressDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        phase={engine.phase}
        stage={engine.stage}
        error={engine.error}
        txHash={engine.result?.txHash ?? null}
        ledgerPending={ledgerPending}
      />
    </div>
  );
}

function AmountPresets({
  value,
  onPick,
  disabled,
}: {
  value: string;
  onPick: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {PRESETS.map((n) => {
        const selected = value === String(n);
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onPick(String(n))}
            aria-pressed={selected}
            className={cn(
              "rounded-xl border px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
