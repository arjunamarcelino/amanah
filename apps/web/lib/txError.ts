// Extract a readable message from a viem/wagmi error. viem errors carry a concise
// `shortMessage`; fall back to `message`. Distinguishes a user rejection so the UI
// can treat it as benign (let them retry) rather than a failure.
export function txErrorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { shortMessage?: unknown; message?: unknown };
    if (typeof o.shortMessage === "string" && o.shortMessage) return o.shortMessage;
    if (typeof o.message === "string" && o.message) return o.message;
  }
  return "Transaction failed";
}

export function isUserRejection(e: unknown): boolean {
  const msg = txErrorMessage(e).toLowerCase();
  return msg.includes("rejected") || msg.includes("denied") || msg.includes("user cancel");
}
