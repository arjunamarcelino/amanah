import type { Hex, TransactionReceipt } from "viem";

// Shared transaction-flow vocabulary. Lives in lib/ (not in a component) so both the
// hooks and TxStatus import it without a lib -> components dependency inversion.
export type TxPhase = "idle" | "signing" | "mining" | "success" | "error";

// Minimal structural shape of the viem/wagmi public client we need.
type ReceiptClient = {
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<TransactionReceipt>;
};

/**
 * Submit a write, surface the hash (→ "mining"), await the receipt, and throw on
 * revert. Factors the repeated write→confirm→assert sequence used by mint + both
 * legs of donate.
 */
export async function sendAndConfirm(
  publicClient: ReceiptClient,
  write: () => Promise<Hex>,
  revertMessage: string,
  onSubmitted?: (hash: Hex) => void,
): Promise<{ hash: Hex; receipt: TransactionReceipt }> {
  const hash = await write();
  onSubmitted?.(hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(revertMessage);
  return { hash, receipt };
}
