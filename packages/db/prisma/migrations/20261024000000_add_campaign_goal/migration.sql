-- Offchain display target (goal) for a campaign, in base units (Decimal(78,0)).
-- Additive and nullable: existing rows keep NULL (no goal / no progress %); not a
-- money column (no funds, no on-chain truth). Raised is never stored — it is summed
-- from confirmed DonationLog rows at read time.
ALTER TABLE "Campaign" ADD COLUMN "goalBase" DECIMAL(78,0);
