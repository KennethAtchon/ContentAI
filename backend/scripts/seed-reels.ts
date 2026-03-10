import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import {
  reels,
  reelAnalyses,
} from "../src/infrastructure/database/drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function main() {
  console.log("Seeding mock reels data for 'personal finance' niche...");

  const mockReels = [
    {
      externalId: "mock-ext-1",
      username: "finance_guru",
      niche: "personal finance",
      views: 1540000,
      likes: 125000,
      comments: 3200,
      engagementRate: "8.32",
      hook: "If you're in your 20s, do these 3 things with your money immediately.",
      caption:
        "Stop waiting to invest! Here is exactly where to put your money when you're young.",
      audioName: "Original Audio - finance_guru",
      thumbnailEmoji: "💸",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1579621970588-a3f5ce5a08def?w=500&q=80",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      daysAgo: 2,
      isViral: true,
    },
    {
      externalId: "mock-ext-2",
      username: "budget_hacks",
      niche: "personal finance",
      views: 890000,
      likes: 64000,
      comments: 1500,
      engagementRate: "7.36",
      hook: "Watch me budget my $5,000 paycheck in under 60 seconds.",
      caption:
        "Zero-based budgeting changed my life. Here's how I allocate every single dollar.",
      audioName: "Trending Sound 12",
      thumbnailEmoji: "📊",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&q=80",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      daysAgo: 5,
      isViral: true,
    },
    {
      externalId: "mock-ext-3",
      username: "wealth_builder",
      niche: "personal finance",
      views: 2100000,
      likes: 180000,
      comments: 5400,
      engagementRate: "8.82",
      hook: "The 'coffee factor' is a lie. Here's what's actually keeping you broke.",
      caption:
        "Cutting out your $5 latte won't make you rich. Focus on housing, transportation, and income generation instead.",
      audioName: "Beat Drop Remix - DJ Wealth",
      thumbnailEmoji: "☕",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=500&q=80",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      daysAgo: 1,
      isViral: true,
    },
    {
      externalId: "mock-ext-4",
      username: "investing_101",
      niche: "personal finance",
      views: 450000,
      likes: 22000,
      comments: 800,
      engagementRate: "5.06",
      hook: "What are Index Funds? (Explained for absolute beginners)",
      caption:
        "Investing doesn't have to be complicated or scary. Let's break down the easiest way to start.",
      audioName: "LoFi Study Beats",
      thumbnailEmoji: "📈",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&q=80",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      daysAgo: 10,
      isViral: false,
    },
  ];

  try {
    for (const reelData of mockReels) {
      console.log(`Inserting reel: ${reelData.hook}`);

      const insertResult = await db
        .insert(reels)
        .values(reelData)
        .returning({ id: reels.id })
        .onConflictDoNothing({ target: reels.externalId });

      // If there was a conflict and we ignored, try fetching the existing id
      let reelId;
      if (insertResult.length === 0) {
        // Find existing
        const existing = await db
          .select()
          .from(reels)
          .where(eq(reels.externalId, reelData.externalId));
        if (existing.length > 0) reelId = existing[0].id;
      } else {
        reelId = insertResult[0].id;
      }

      if (reelId) {
        // Create matching analysis
        const mockAnalysis = {
          reelId: reelId,
          hookPattern: reelData.hook.includes("?")
            ? "Question Hook"
            : "Statement Hook",
          hookCategory: "Educational",
          emotionalTrigger: "Curiosity",
          formatPattern: "Talking Head + Text Overlay",
          ctaType: "Save for later",
          captionFramework: "Problem-Agitate-Solve",
          curiosityGapStyle: "Revealing a secret",
          remixSuggestion:
            "React to this video but share a contradictory opinion or personal story connecting to the topic.",
          analysisModel: "gpt-4o-mini",
          rawResponse: { note: "Mock auto-generated analysis." },
        };

        // Ensure we don't duplicate analysis if it already exists
        const existingAnalysis = await db
          .select()
          .from(reelAnalyses)
          .where(eq(reelAnalyses.reelId, reelId));
        if (existingAnalysis.length === 0) {
          await db.insert(reelAnalyses).values(mockAnalysis);
          console.log(` Inserted analysis for reel ${reelId}`);
        }
      }
    }
    console.log("✅ Seed completed successfully.");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
