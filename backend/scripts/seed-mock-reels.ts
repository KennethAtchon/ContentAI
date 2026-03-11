/**
 * Seed the database with mock reels from the AIStudioDesign reference data.
 * Run with: bun run src/scripts/seed-mock-reels.ts
 *
 * NOTE: This script upserts niches first, then inserts reels with the correct nicheId FK.
 */
import { db } from "../src/services/db/db";
import { reels, niches } from "../src/infrastructure/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { debugLog } from "../src/utils/debug/debug";

const MOCK_NICHES = [
  {
    name: "personal finance",
    description: "Personal finance tips, investing, and saving",
  },
  {
    name: "health & fitness",
    description: "Fitness, nutrition, and wellness content",
  },
];

const mockReelsByNiche: Record<
  string,
  Omit<typeof reels.$inferInsert, "nicheId">[]
> = {
  "personal finance": [
    {
      username: "@financeflips",
      views: 2400000,
      likes: 187000,
      comments: 4200,
      engagementRate: "7.97",
      hook: "You're losing $400/month and you don't even know it.",
      caption:
        "Here's why your savings account is secretly working against you 🧵 Most people think a savings account = smart money. But with inflation at 3.4%, your 0.5% APY is actually losing you purchasing power every single day. Here's what to do instead: 1. HYSA with 4.5%+ APY 2. I-Bonds for inflation protection 3. Money market funds for liquidity Follow for more money moves that actually work. #personalfinance #money #investing #savingsaccount #financetips",
      audioName: "Original Sound - financeflips",
      audioId: "SND_7392847561",
      thumbnailEmoji: "💰",
      daysAgo: 3,
      isViral: true,
    },
    {
      username: "@wealthwire",
      views: 1820000,
      likes: 143000,
      comments: 6800,
      engagementRate: "8.24",
      hook: "My 23-year-old client just hit $100K. Here's the exact breakdown.",
      caption:
        "Breaking down how a 23-year-old reached $100K net worth in 2 years on a $52K salary. No inheritance. No crypto moonshots. Just boring, consistent habits. Save this post and start automating today. #millennialmoney #100k #networth #financialfreedom #wealthbuilding",
      audioName: "Money Trees - Kendrick Lamar",
      audioId: "SND_8847261930",
      thumbnailEmoji: "📊",
      daysAgo: 5,
      isViral: true,
    },
    {
      username: "@dollardeep",
      views: 3100000,
      likes: 221000,
      comments: 9100,
      engagementRate: "7.43",
      hook: "This 5-minute task saved me $12,000 last year.",
      caption:
        "I spent 5 minutes canceling subscriptions I forgot I had. Total saved: $12,340/year. #frugal #savemoney #budgeting #subscriptions #personalfinance",
      audioName: "Rich Girl - Hall & Oates (Sped Up)",
      audioId: "SND_9921847302",
      thumbnailEmoji: "✂️",
      daysAgo: 7,
      isViral: true,
    },
    {
      username: "@investiq",
      views: 980000,
      likes: 89000,
      comments: 3400,
      engagementRate: "9.44",
      hook: "Stop putting money in your 401k until you do this first.",
      caption:
        "Controversial take: If you have high-interest debt, your 401k is hurting you. Here's why. #401k #debtfree #personalfinance #investing #financialliteracy",
      audioName: "Ambition - Wale ft. Meek Mill",
      audioId: "SND_3312974856",
      thumbnailEmoji: "📈",
      daysAgo: 2,
      isViral: true,
    },
  ],
  "health & fitness": [
    {
      username: "@fithealthpro",
      views: 1540000,
      likes: 112000,
      comments: 5200,
      engagementRate: "7.61",
      hook: "You've been doing cardio wrong for years. Here's the fix.",
      caption:
        "Zone 2 cardio is the most underrated fat loss tool most people ignore. 45 mins 3x/week. That's it. #fitness #cardio #fatloss #health #zone2",
      audioName: "Good 4 U - Olivia Rodrigo (Workout Mix)",
      audioId: "SND_5512984720",
      thumbnailEmoji: "🏃",
      daysAgo: 4,
      isViral: true,
    },
    {
      username: "@nutritionhack",
      views: 2200000,
      likes: 178000,
      comments: 7800,
      engagementRate: "8.45",
      hook: "The #1 reason you can't lose weight has nothing to do with food.",
      caption:
        "Sleep deprivation increases ghrelin (hunger hormone) by 28%. Tag someone who needs to hear this. #weightloss #nutrition #sleep #health #hormones",
      audioName: "Original Audio - nutritionhack",
      audioId: "SND_7781234560",
      thumbnailEmoji: "😴",
      daysAgo: 6,
      isViral: true,
    },
  ],
};

async function seed() {
  debugLog.info("Seeding mock niches and reels...", {
    service: "seed",
    operation: "seed",
  });

  let totalReels = 0;

  for (const nicheData of MOCK_NICHES) {
    // Upsert the niche
    const [niche] = await db
      .insert(niches)
      .values(nicheData)
      .onConflictDoUpdate({
        target: niches.name,
        set: { description: nicheData.description },
      })
      .returning();

    // Fetch to ensure we have the id even on conflict
    const [existingNiche] = await db
      .select()
      .from(niches)
      .where(eq(niches.name, nicheData.name))
      .limit(1);

    const nicheId = niche?.id ?? existingNiche?.id;
    if (!nicheId) {
      debugLog.error(`Failed to get nicheId for "${nicheData.name}"`, {
        service: "seed",
        operation: "seed",
      });
      continue;
    }

    const reelData = mockReelsByNiche[nicheData.name] ?? [];
    for (const reel of reelData) {
      await db
        .insert(reels)
        .values({ ...reel, nicheId })
        .onConflictDoNothing();
      totalReels++;
    }

    debugLog.info(
      `Seeded ${reelData.length} reels for niche "${nicheData.name}"`,
      {
        service: "seed",
        operation: "seed",
      },
    );
  }

  debugLog.info(
    `Done. Seeded ${MOCK_NICHES.length} niches, ${totalReels} reels.`,
    {
      service: "seed",
      operation: "seed",
    },
  );
  process.exit(0);
}

seed().catch((err) => {
  debugLog.error("Seed failed", {
    service: "seed",
    operation: "seed",
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
