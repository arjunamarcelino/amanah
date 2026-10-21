import { PrismaClient } from "@amanah/db";

// Single client for the worker. connection_limit is set low in DATABASE_URL
// (the indexer is single-threaded and sequential).
export const prisma = new PrismaClient();
