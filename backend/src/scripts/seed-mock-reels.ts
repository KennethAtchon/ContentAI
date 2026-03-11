/**
 * Seed the database with mock reels from the AIStudioDesign reference data.
 * Run with: bun run src/scripts/seed-mock-reels.ts
 */
import { db } from "../services/db/db";
import { reels } from "../infrastructure/database/drizzle/schema";
import { debugLog } from "../utils/debug/debug";

const mockReels = [
  {
    username: "@financeflips",
    niche: "personal finance",
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
    niche: "personal finance",
    views: 1820000,
    likes: 143000,
    comments: 6800,
    engagementRate: "8.24",
    hook: "My 23-year-old client just hit $100K. Here's the exact breakdown.",
    caption:
      "Breaking down how a 23-year-old reached $100K net worth in 2 years on a $52K salary. No inheritance. No crypto moonshots. Just boring, consistent habits. Roth IRA: $12,400 | 401k match: $8,200 | Index funds: $47,000 | HYSA: $18,000 | Misc: $14,400 The secret? Automating 30% of every paycheck before it touched his checking account. Save this post and start automating today. #millennialmoney #100k #networth #financialfreedom #wealthbuilding",
    audioName: "Money Trees - Kendrick Lamar",
    audioId: "SND_8847261930",
    thumbnailEmoji: "📊",
    daysAgo: 5,
    isViral: true,
  },
  {
    username: "@dollardeep",
    niche: "personal finance",
    views: 3100000,
    likes: 221000,
    comments: 9100,
    engagementRate: "7.43",
    hook: "This 5-minute task saved me $12,000 last year.",
    caption:
      "I spent 5 minutes canceling subscriptions I forgot I had. Total saved: $12,340/year. Here's the list that shocked me: Adobe CC ($600/yr) | Calm app ($70/yr) | 3 unused gym memberships ($1,400/yr) | Forgotten Prime trial x4 ($560/yr) | Hulu + Disney + Netflix + Max ($1,440/yr). Use Rocket Money or Trim to find yours automatically. The average American wastes $348/month on forgotten subscriptions. Check yours tonight. #frugal #savemoney #budgeting #subscriptions #personalfinance",
    audioName: "Rich Girl - Hall & Oates (Sped Up)",
    audioId: "SND_9921847302",
    thumbnailEmoji: "✂️",
    daysAgo: 7,
    isViral: true,
  },
  {
    username: "@investiq",
    niche: "personal finance",
    views: 980000,
    likes: 89000,
    comments: 3400,
    engagementRate: "9.44",
    hook: "Stop putting money in your 401k until you do this first.",
    caption:
      "Controversial take: If you have high-interest debt, your 401k is hurting you. Here's why. Credit card at 24% APR vs. 401k returning ~10%/yr. The math is simple. Pay the debt first. Exception: Get the employer match first (it's free money). Then attack debt. Then max the 401k. Order matters. Sequence of returns matters. Comment 'DEBT' and I'll send you my debt payoff resource. #401k #debtfree #personalfinance #investing #financialliteracy",
    audioName: "Ambition - Wale ft. Meek Mill",
    audioId: "SND_3312974856",
    thumbnailEmoji: "📈",
    daysAgo: 2,
    isViral: true,
  },
  {
    username: "@fithealthpro",
    niche: "health & fitness",
    views: 1540000,
    likes: 112000,
    comments: 5200,
    engagementRate: "7.61",
    hook: "You've been doing cardio wrong for years. Here's the fix.",
    caption:
      "Zone 2 cardio is the most underrated fat loss tool most people ignore. What is Zone 2? It's 60-70% of your max heart rate. You can hold a conversation. It feels TOO easy. But here's what it does: Burns fat as primary fuel | Builds mitochondria | Improves insulin sensitivity | Reduces cortisol. 45 mins 3x/week. That's it. Your 'fat burning zone' isn't HIIT. It's this. Save this and try it tomorrow. #fitness #cardio #fatloss #health #zone2",
    audioName: "Good 4 U - Olivia Rodrigo (Workout Mix)",
    audioId: "SND_5512984720",
    thumbnailEmoji: "🏃",
    daysAgo: 4,
    isViral: true,
  },
  {
    username: "@nutritionhack",
    niche: "health & fitness",
    views: 2200000,
    likes: 178000,
    comments: 7800,
    engagementRate: "8.45",
    hook: "The #1 reason you can't lose weight has nothing to do with food.",
    caption:
      "Sleep deprivation increases ghrelin (hunger hormone) by 28% and decreases leptin (fullness hormone) by 18%. Translation: You're not weak. You're sleep-deprived and your hormones are working against you. 7-9 hours isn't a luxury. It's a fat loss requirement. Prioritize sleep before you optimize macros. The data is clear. Tag someone who needs to hear this. #weightloss #nutrition #sleep #health #hormones",
    audioName: "Original Audio - nutritionhack",
    audioId: "SND_7781234560",
    thumbnailEmoji: "😴",
    daysAgo: 6,
    isViral: true,
  },
];

async function seed() {
  debugLog.info("Seeding mock reels...", {
    service: "seed",
    operation: "seed",
  });

  for (const reel of mockReels) {
    await db.insert(reels).values(reel).onConflictDoNothing();
  }

  debugLog.info(`Seeded ${mockReels.length} reels.`, {
    service: "seed",
    operation: "seed",
  });
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
