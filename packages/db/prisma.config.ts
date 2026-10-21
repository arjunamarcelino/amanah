// Prisma configuration (GA since Prisma 6.13). Replaces the deprecated
// `package.json#prisma` key. NOTE: once this file exists, Prisma no longer
// auto-loads `.env`, so we import dotenv/config explicitly here. `DATABASE_URL`
// is still read by the schema via env("DATABASE_URL").
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    // Node 22+ ESM-friendly seed runner (preferred over ts-node).
    seed: "tsx prisma/seed.ts",
  },
});
