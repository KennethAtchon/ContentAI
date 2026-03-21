## Generation System

This document explains how reel analysis and content generation actually work — why there are two separate AI calls, what each one does, and how they relate.

---

## Two Different AI Tasks, Two Different Models

The generation system is actually two distinct operations that are designed to work together:

**Reel Analysis** answers the question: *why does this reel work?* It takes a scraped reel's metadata (the hook text, caption, view count, engagement) and asks an AI to classify it — what emotional hook does it use, what format pattern, what call-to-action style, how does it create curiosity. The output is structured JSON, not prose.

**Content Generation** answers the question: *how do I make something like this for my audience?* It takes the reel's analysis as context and a user's prompt ("remix this for personal finance targeting millennials"), then generates actual content — hooks, captions, script outlines.

These use different AI models on purpose. Analysis uses Claude Haiku (cheap, fast) because the job is mechanical: extract patterns from a fixed taxonomy, return JSON. There's no creativity involved — just classification. Generation uses Claude Sonnet (smarter, more expensive) because creative writing quality matters and the output goes directly to users.

---

## Why Analysis Happens First

You can't generate useful content without first analyzing the reel. The analysis is what gives the AI generator the strategic context it needs — knowing that a reel used a "bold claim opener" with "fear of missing out" triggers is what lets the generator replicate that pattern in a different niche.

Analysis results are stored in the database so you only pay for it once per reel. Every user who analyzes the same reel shares the same analysis row. Generation always runs fresh because it depends on the user's specific prompt and direction.

---

## What Analysis Actually Extracts

The AI is asked to classify the reel against a specific taxonomy — it's not open-ended. Fields like "hook pattern" have known values (bold claim, question, storytime, controversy, tutorial). "Emotional trigger" has known values (FOMO, inspiration, shock, humor). The prompt tells the AI to return JSON matching that structure, and the backend validates the response against a schema before saving it. If Claude returns something that doesn't fit the schema, the request fails.

The most useful output is `remixSuggestion` — a concrete suggestion for how to apply this reel's patterns to a different audience. This feeds directly into generation.

---

## What Generation Actually Does

The generation prompt gives the AI:
- The source reel's hook, caption, niche, and key metrics
- The full analysis of that reel (patterns, triggers, format, CTA)
- The user's specific direction ("remix this for...")
- An instruction to return structured output (hooks, caption, script notes)

The AI is essentially pattern-matching and adapting — it understands what made the source reel work and applies those structural elements to the user's topic. The user's prompt steers the niche and angle; the analysis data steers the format and approach.

Generated content is always saved to the database as a draft. It's never a fire-and-forget response — the draft record is what everything downstream (voiceovers, video clips, assembly, the queue) attaches to.

---

## The Relationship Between Reels and Generated Content

A reel has one analysis (or none, until analyzed). A reel can have many generated content items — different users generating different content from the same reel. Generated content links back to the source reel and its analysis for traceability, but it stands alone once created. Deleting or updating the source reel doesn't affect existing drafts.

---

## Usage Limits and Why They Exist

Both analysis and generation consume AI API credits. The backend checks the user's daily usage count against their tier's limit before running either operation. This check queries the `feature_usage` table — a row is written for each successful generation. The limit is enforced server-side regardless of what the UI shows.

Analysis and generation count separately against their own limits. The limits reset at midnight each day.
