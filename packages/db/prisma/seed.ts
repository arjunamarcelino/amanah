// Idempotent seed: offchain metadata + rail catalog only. NEVER seeds a
// `confirmed` donation — confirmed rows must correspond to a real on-chain event
// (glass-box honesty). Re-runnable: campaign upserts touch metadata only (never
// the indexer-owned `registeredOnChain`/`active`), rails key on (name,country).
//
// campaignId is derived from the human slug via the SAME helper the on-chain
// registration uses, so indexed events join to this metadata.
import { campaignIdFromSlug } from "@amanah/shared";
import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

/** bytes32(0) — the general/unattributed fund (CharityPool campaignId == 0). */
const GENERAL_FUND_ID = `0x${"0".repeat(64)}`;

const campaigns = [
  {
    slug: "ph-typhoon-2025",
    type: "disaster",
    cause: "Typhoon disaster relief",
    name: "Philippines Typhoon 2025 (flagship)",
    country: "PH",
    releaseType: "PARAMETRIC" as const,
    recipientOrg: "PH Disaster Relief Network",
  },
  {
    slug: "id-rural-school-supplies",
    type: "education",
    cause: "School supplies for rural students",
    name: "Rural Indonesia School Supplies",
    country: "ID",
    releaseType: "MILESTONE" as const,
    recipientOrg: "Yayasan Pendidikan Desa",
  },
  {
    slug: "clinic-medicine-fund",
    type: "medical",
    cause: "Essential medicine for a community clinic",
    name: "Clinic Medicine Fund",
    country: "ID",
    releaseType: "MILESTONE" as const,
    recipientOrg: "Community Health Clinic",
  },
  {
    slug: "masjid-waqf",
    type: "waqf",
    cause: "Masjid waqf endowment",
    name: "Masjid Waqf",
    country: "ID",
    releaseType: "MILESTONE" as const,
    recipientOrg: "Waqf Board",
  },
];

const railsPH = [
  { name: "GCash", country: "PH", feeBps: 50, liquidity: "high", etaMinutes: 5 },
  { name: "Maya", country: "PH", feeBps: 60, liquidity: "high", etaMinutes: 10 },
  { name: "InstaPay Bank Transfer", country: "PH", feeBps: 30, liquidity: "medium", etaMinutes: 15 },
];

// Indonesia rails — the seeded MILESTONE campaigns (id-rural-school-supplies,
// clinic-medicine-fund, masjid-waqf) are ID, so the agent/UI needs ID candidates.
const railsID = [
  { name: "GoPay", country: "ID", feeBps: 55, liquidity: "high", etaMinutes: 5 },
  { name: "DANA", country: "ID", feeBps: 50, liquidity: "high", etaMinutes: 10 },
  { name: "BI-FAST Bank Transfer", country: "ID", feeBps: 25, liquidity: "medium", etaMinutes: 15 },
];

const rails = [...railsPH, ...railsID];

async function main() {
  for (const c of campaigns) {
    const campaignId = campaignIdFromSlug(c.slug);
    await prisma.campaign.upsert({
      where: { campaignId },
      // Metadata only on update — never reset indexer-owned registeredOnChain/active.
      update: {
        type: c.type,
        cause: c.cause,
        name: c.name,
        country: c.country,
        releaseType: c.releaseType,
        recipientOrg: c.recipientOrg,
      },
      create: {
        campaignId,
        type: c.type,
        cause: c.cause,
        name: c.name,
        country: c.country,
        releaseType: c.releaseType,
        recipientOrg: c.recipientOrg,
        active: true,
      },
    });
  }

  // General/unattributed fund — keep a well-known row so campaignId==0 donations
  // join cleanly. Not a listable campaign (active:false).
  await prisma.campaign.upsert({
    where: { campaignId: GENERAL_FUND_ID },
    update: {},
    create: {
      campaignId: GENERAL_FUND_ID,
      type: "general",
      cause: "General unattributed fund",
      name: "General Fund",
      releaseType: "MILESTONE",
      active: false,
    },
  });

  for (const r of rails) {
    await prisma.rail.upsert({
      where: { name_country: { name: r.name, country: r.country } },
      update: { feeBps: r.feeBps, liquidity: r.liquidity, etaMinutes: r.etaMinutes, active: true },
      create: r,
    });
  }

  const [campaignCount, railCount] = await Promise.all([
    prisma.campaign.count(),
    prisma.rail.count(),
  ]);
  console.log(`seed: ${campaignCount} campaigns, ${railCount} rails`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
