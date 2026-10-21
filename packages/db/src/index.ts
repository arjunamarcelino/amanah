// Re-export the generated Prisma client. Run `pnpm --filter @amanah/db generate`
// (or `pnpm turbo run build`) to produce ./generated/client before importing.
export * from "./generated/client";
export { PrismaClient } from "./generated/client";

// Monotonic write repository — the only sanctioned way to write the money tables.
export * from "./repository";
