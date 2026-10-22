"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { parseTokenAmount, formatTokenAmount, AMOUNT_ERROR_MESSAGE } from "@/lib/amount";
import { tokenByKey, type StablecoinKey } from "@/lib/tokens";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { useErc20 } from "@/lib/hooks/useErc20";
import { useMint } from "@/lib/hooks/useMint";
import { StablecoinSelect } from "@/components/StablecoinSelect";
import { AmountField } from "@/components/AmountField";
import { TxStatus } from "@/components/TxStatus";
import { LoginGate } from "@/components/LoginGate";
import { ChainGuard } from "@/components/ChainGuard";
import { GasPrompt } from "@/components/GasPrompt";

// Wallet page — never statically prerendered (providers only exist at runtime).
export const dynamic = "force-dynamic";

export default function MintPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6 md:p-10">
      <div>
        <Link href="/" className="text-sm text-foreground-soft underline underline-offset-4">
          ← Back to campaigns
        </Link>
        <h1 className="mt-3 text-3xl">Mint test tokens</h1>
        <p className="text-sm text-foreground-soft">
          Mint mock stablecoins to your wallet so you can try a donation on Base Sepolia.
        </p>
      </div>
      <LoginGate>
        <ChainGuard>
          <GasPrompt>
            <MintForm />
          </GasPrompt>
        </ChainGuard>
      </LoginGate>
    </main>
  );
}

function MintForm() {
  const { state, refetchBalance } = useDonorWallet();
  const [coin, setCoin] = useState<StablecoinKey>("mUSDC");
  const [input, setInput] = useState("");
  const { mint, phase, error, txHash, pending } = useMint();

  const token = tokenByKey(coin);
  const owner = state.status === "active" ? state.address : undefined;
  const { balance, refetch } = useErc20(token, owner);

  const parsed = useMemo(() => parseTokenAmount(input), [input]);
  const amountError = input !== "" && !parsed.ok ? AMOUNT_ERROR_MESSAGE[parsed.error] : null;

  async function onMint() {
    if (!parsed.ok || !owner) return;
    await mint(token, owner, parsed.value);
    await refetch();
    refetchBalance();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faucet</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <StablecoinSelect value={coin} onChange={setCoin} disabled={pending} />
        <AmountField
          label="Amount to mint"
          value={input}
          onChange={setInput}
          error={amountError}
          disabled={pending}
        />
        {balance !== undefined ? (
          <p className="text-xs text-foreground-soft">
            Balance: {formatTokenAmount(balance)} {coin}
          </p>
        ) : null}
        <Button onClick={onMint} disabled={pending || !parsed.ok}>
          {pending ? "Minting…" : `Mint ${coin}`}
        </Button>
        {phase === "success" ? (
          <p className="text-sm text-primary">Minted. Your balance is updated.</p>
        ) : null}
        <TxStatus phase={phase} error={error} txHash={txHash} pendingLabel="Minting tokens…" />
        <Link href="/" className="text-sm text-primary underline underline-offset-4">
          Browse campaigns to donate →
        </Link>
      </CardContent>
    </Card>
  );
}
