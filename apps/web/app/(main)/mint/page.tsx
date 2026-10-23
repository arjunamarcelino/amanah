"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@amanah/ui/button";
import { parseTokenAmount, formatTokenAmount, AMOUNT_ERROR_MESSAGE } from "@/lib/amount";
import { tokenByKey, type StablecoinKey } from "@/lib/tokens";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { useErc20 } from "@/lib/hooks/useErc20";
import { useMint } from "@/lib/hooks/useMint";
import { StablecoinSelect } from "@/components/StablecoinSelect";
import { AmountField } from "@/components/AmountField";
import { TxStatus } from "@/components/TxStatus";
import { RequireWallet } from "@/components/RequireWallet";
import { ChainGuard } from "@/components/ChainGuard";
import { GasPrompt } from "@/components/GasPrompt";

// Wallet page — never statically prerendered (providers only exist at runtime).
export const dynamic = "force-dynamic";

export default function MintPage() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-10 md:py-16">
      {/* Back link stays above the card. */}
      <Link
        href="/"
        className="text-sm text-foreground-soft underline underline-offset-4 hover:no-underline"
      >
        ← Back to campaigns
      </Link>

      <div className="mt-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="font-serif text-3xl tracking-tight text-foreground">
              Mint test tokens
            </h1>
            <p className="text-sm text-foreground-soft">
              Mint mock stablecoins to your wallet so you can try a donation on Base Sepolia.
            </p>
          </div>
          <RequireWallet>
            <ChainGuard>
              <GasPrompt>
                <MintForm />
              </GasPrompt>
            </ChainGuard>
          </RequireWallet>
        </div>
      </div>
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
    <div className="flex flex-col gap-4">
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
    </div>
  );
}
