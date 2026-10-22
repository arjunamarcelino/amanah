/** Parse a CAIP-2 chain id ("eip155:84532") to its numeric id, or undefined. */
export function caipToChainId(caip: string | undefined): number | undefined {
  if (!caip) return undefined;
  const n = Number(caip.split(":").at(-1));
  return Number.isFinite(n) ? n : undefined;
}
