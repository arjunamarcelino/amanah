-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('PARAMETRIC', 'MILESTONE');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('pending', 'confirmed', 'expired');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'released', 'routed', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "name" TEXT,
    "country" TEXT,
    "releaseType" "ReleaseType" NOT NULL,
    "recipientOrg" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "registeredOnChain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rail" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "liquidity" TEXT NOT NULL,
    "etaMinutes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationLog" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "blockNumber" BIGINT,
    "donor" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stablecoin" TEXT NOT NULL,
    "amountIn" DECIMAL(78,0) NOT NULL,
    "baseOut" DECIMAL(78,0) NOT NULL,
    "consentHash" TEXT NOT NULL,
    "status" "DonationStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "DonationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutDecision" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "usdcAmount" DECIMAL(78,0) NOT NULL,
    "rail" TEXT,
    "feeBpsCovered" INTEGER,
    "rationale" TEXT,
    "fallbackUsed" BOOLEAN,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "unlockTime" BIGINT,
    "releasedTxHash" TEXT,
    "routedTxHash" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventIndex" (
    "id" BIGSERIAL NOT NULL,
    "eventName" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "campaignId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerCursor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_campaignId_key" ON "Campaign"("campaignId");

-- CreateIndex
CREATE INDEX "Campaign_type_idx" ON "Campaign"("type");

-- CreateIndex
CREATE INDEX "Rail_country_active_idx" ON "Rail"("country", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Rail_name_country_key" ON "Rail"("name", "country");

-- CreateIndex
CREATE INDEX "DonationLog_campaignId_status_idx" ON "DonationLog"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DonationLog_txHash_logIndex_key" ON "DonationLog"("txHash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutDecision_payoutId_key" ON "PayoutDecision"("payoutId");

-- CreateIndex
CREATE INDEX "PayoutDecision_campaignId_status_idx" ON "PayoutDecision"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EventIndex_blockNumber_logIndex_idx" ON "EventIndex"("blockNumber", "logIndex");

-- CreateIndex
CREATE INDEX "EventIndex_campaignId_blockNumber_logIndex_idx" ON "EventIndex"("campaignId", "blockNumber", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "EventIndex_txHash_logIndex_key" ON "EventIndex"("txHash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerCursor_name_key" ON "IndexerCursor"("name");

-- Hand-added (Prisma PSL cannot express these):

-- Partial indexes keep the auto-expire sweep O(pending) instead of a full table
-- scan as confirmed rows accumulate (entries drop out as rows leave 'pending').
CREATE INDEX "DonationLog_pending_createdAt_idx" ON "DonationLog"("createdAt") WHERE "status" = 'pending';
CREATE INDEX "PayoutDecision_pending_createdAt_idx" ON "PayoutDecision"("createdAt") WHERE "status" = 'pending';

-- DB-level non-negativity for the money mirror (defence-in-depth alongside the
-- zod DecimalString refinement at the API edge).
ALTER TABLE "DonationLog" ADD CONSTRAINT "DonationLog_amountIn_nonneg" CHECK ("amountIn" >= 0);
ALTER TABLE "DonationLog" ADD CONSTRAINT "DonationLog_baseOut_nonneg" CHECK ("baseOut" >= 0);
ALTER TABLE "PayoutDecision" ADD CONSTRAINT "PayoutDecision_usdcAmount_nonneg" CHECK ("usdcAmount" >= 0);

