"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import type { CampaignResponse } from "@amanah/shared";
import { buildDonationPayload } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { Badge } from "@amanah/ui/badge";
import { getCampaigns, postDonation } from "@/lib/api";
import { asBytes32 } from "@/lib/hex";
import { ZERO_CAMPAIGN_ID } from "@/lib/campaigns";
import { parseTokenAmount, formatTokenAmount, AMOUNT_ERROR_MESSAGE } from "@/lib/amount";
import { tokenByKey, type StablecoinKey } from "@/lib/tokens";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { useErc20 } from "@/lib/hooks/useErc20";
import { useDonateEngine } from "@/lib/hooks/useDonateEngine";
import { StablecoinSelect } from "@/components/StablecoinSelect";
import { AmountField } from "@/components/AmountField";
import { ConsentBox } from "@/components/ConsentBox";
import { TxStatus } from "@/components/TxStatus";
import { DonateSuccess } from "@/components/DonateSuccess";
import { LoginGate } from "@/components/LoginGate";
import { ChainGuard } from "@/components/ChainGuard";
import { GasPrompt } from "@/components/GasPrompt";

// Wallet page — never statically prerendered.
export const dynamic = "force-dynamic";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6 md:p-10">
      <Link href="/" className="text-sm text-foreground-soft underline underline-offset-4">
        ← Back to campaigns
      </Link>
      {children}
    </main>
  );
}

function Blocked({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-6">
      <h1 className="text-xl">{title}</h1>
      <Link href="/">
        <Button variant="outline">Browse campaigns</Button>
      </Link>
    </div>
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

  if (!validId || validId === ZERO_CAMPAIGN_ID) return <Shell><Blocked title="Campaign not found" /></Shell>;
  if (isLoading) return <Shell><p className="text-foreground-soft">Loading campaign…</p></Shell>;
  if (isError) {
    return (
      <Shell>
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-6">
          <p className="text-sm text-foreground-soft">Couldn&apos;t load this campaign.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </Shell>
    );
  }

  const campaign = (data ?? []).find((c) => c.campaignId.toLowerCase() === validId);
  // Gate BEFORE any wallet interaction — donate() pulls funds for any campaignId and
  // does NOT check registration, so this is a fund-misdirection control (S-2).
  if (!campaign) return <Shell><Blocked title="Campaign not found" /></Shell>;
  if (!campaign.active) return <Shell><Blocked title="This campaign is not active" /></Shell>;
  if (!campaign.registeredOnChain) {
    return <Shell><Blocked title="This campaign isn't open for donations yet" /></Shell>;
  }

  return (
    <Shell>
      <ConfirmHeader campaign={campaign} />
      <LoginGate>
        <ChainGuard>
          <GasPrompt>
            <DonateForm campaignId={validId} />
          </GasPrompt>
        </ChainGuard>
      </LoginGate>
    </Shell>
  );
}

function ConfirmHeader({ campaign }: { campaign: CampaignResponse }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge className="capitalize">{campaign.type}</Badge>
        {campaign.country ? (
          <span className="text-xs text-foreground-soft">{campaign.country}</span>
        ) : null}
        <Badge variant="outline" className="capitalize">
          {campaign.releaseType.toLowerCase()}
        </Badge>
      </div>
      <h1 className="text-2xl">{campaign.name ?? campaign.cause}</h1>
      <p className="text-sm text-foreground-soft">{campaign.cause}</p>
    </div>
  );
}

function DonateForm({ campaignId }: { campaignId: Hex }) {
  const { state } = useDonorWallet();
  const owner = state.status === "active" ? state.address : undefined;

  const [coin, setCoin] = useState<StablecoinKey>("mUSDC");
  const [input, setInput] = useState("");
  const [consent, setConsent] = useState(false);
  const [ledgerPending, setLedgerPending] = useState(false);

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
    parsed.ok && !insufficient && consent && Boolean(owner) && !engine.pending;

  async function onDonate() {
    if (!parsed.ok || !owner) return;
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

  if (engine.step === "success" && engine.result) {
    return <DonateSuccess txHash={engine.result.txHash} ledgerPending={ledgerPending} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Make a donation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <StablecoinSelect value={coin} onChange={setCoin} disabled={engine.pending} />
        <AmountField
          label="Donation amount"
          value={input}
          onChange={setInput}
          error={amountError ?? (insufficient ? "Amount exceeds your balance" : null)}
          disabled={engine.pending}
        />
        {balance !== undefined ? (
          <p className="text-xs text-foreground-soft">
            Balance: {formatTokenAmount(balance)} {coin} ·{" "}
            <Link href="/mint" className="text-primary underline underline-offset-4">
              Mint more
            </Link>
          </p>
        ) : null}
        <ConsentBox checked={consent} onChange={setConsent} disabled={engine.pending} />
        <Button onClick={onDonate} disabled={!canDonate}>
          {engine.pending ? "Processing…" : `Donate ${coin}`}
        </Button>
        <TxStatus
          phase={engine.step === "approving" || engine.step === "donating" ? "mining" : engine.step}
          error={engine.error}
          txHash={engine.result?.txHash ?? null}
          pendingLabel={engine.step === "approving" ? "Approving spend…" : "Confirming donation…"}
        />
      </CardContent>
    </Card>
  );
}
