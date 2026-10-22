/**
 * Exhaustiveness guard. Call in the `default` branch of a switch over a discriminated
 * union — if a new member is added without a handler, this becomes a compile error.
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
