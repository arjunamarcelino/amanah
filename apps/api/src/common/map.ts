import type { Prisma } from "@amanah/db";

// Explicit serialization at the response boundary. Services return these mapped
// shapes (never raw Prisma rows) so a Decimal/bigint never reaches JSON as a
// lossy number. The SerializeGuardInterceptor is only a dev backstop.

export const toIso = (d: Date): string => d.toISOString();

/** Decimal(78,0) -> exact integer string. Never Number(). */
export const decToString = (d: Prisma.Decimal): string => d.toFixed(0);

export const bigIntToString = (b: bigint | null): string | null =>
  b === null ? null : b.toString();
