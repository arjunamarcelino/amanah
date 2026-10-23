-- Covering index for the per-campaign confirmed-donation sum in GET /campaigns (baseRaised).
-- Including baseOut lets the `groupBy _sum` read the value from the index instead of a heap
-- fetch per confirmed row. NOTE: plain CREATE INDEX takes a brief lock; on a large production
-- table prefer CREATE INDEX CONCURRENTLY (not expressible in Prisma PSL). The scale-proof fix
-- is denormalizing baseRaised onto Campaign (indexer-maintained on confirm).
CREATE INDEX "DonationLog_campaignId_status_baseOut_idx" ON "DonationLog"("campaignId", "status", "baseOut");
