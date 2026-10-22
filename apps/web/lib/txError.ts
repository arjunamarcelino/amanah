// Extract a readable message from a viem/wagmi error. viem errors carry a concise
// `shortMessage`; fall back to `message`.
export function txErrorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { shortMessage?: unknown; message?: unknown };
    if (typeof o.shortMessage === "string" && o.shortMessage) return o.shortMessage;
    if (typeof o.message === "string" && o.message) return o.message;
  }
  return "Transaction failed";
}
