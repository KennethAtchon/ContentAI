# Data Collection Strategy

> **Scope**: Compare scraping vs. API approaches for collecting Instagram Reels data.
> **Decision Needed For**: Phase 1 (MVP) and Phase 2 (Automated Pipeline)

---

## 1. The Core Problem

Instagram does not provide a public, free API for searching Reels by niche keyword and fetching engagement metrics. This means every data collection approach involves tradeoffs between:

- **Coverage** — how much data can be collected
- **Reliability** — how likely it is to break or get blocked
- **Cost** — API fees, proxy costs, developer time
- **Legality / ToS compliance** — Instagram's stance on automated data collection

---

## 2. Option Comparison

### Option A: Selenium (Browser Automation)

**What it does**: Automates a real Chrome browser to visit Instagram pages and extract visible data.

| Aspect | Details |
|---|---|
| **Coverage** | Any public Reel page; limited by what's visible without API access |
| **Reliability** | Medium — Instagram actively detects and blocks bots |
| **Speed** | Slow (2–10 seconds per Reel page) |
| **Cost** | Free (+ proxy costs if needed) |
| **Maintenance** | High — Instagram UI changes break scrapers regularly |
| **Legal Risk** | Medium — violates Instagram ToS; gray zone for research |

**Best for**: Phase 1 MVP — quick to set up, no approval needed.

**Key Libraries**:
- `selenium` + `undetected-chromedriver` (harder to detect)
- `playwright` (alternative, sometimes more stable)

**Anti-Detection Practices**:
- Random sleep intervals (2–5 seconds) between requests
- Rotate user agents
- Use residential proxies (e.g., Brightdata, Oxylabs) if needed
- Log in with a dedicated "research" Instagram account
- Avoid running more than 50–100 scrapes per session

---

### Option B: Instagram Graph API (Official)

**What it does**: Meta's official API for accessing Instagram data. Requires Meta for Developers approval.

| Aspect | Details |
|---|---|
| **Coverage** | Only your own business account's data OR content you're tagged in. **Cannot search by niche.** |
| **Reliability** | Very high — official, documented, stable |
| **Speed** | Fast (API responses in <1 second) |
| **Cost** | Free (within rate limits) |
| **Maintenance** | Low — Meta maintains it |
| **Legal Risk** | None — fully compliant |

**Limitation**: The Instagram Graph API **cannot** search for public Reels by keyword or hashtag in a way that returns engagement metrics for non-owned content. It's primarily for managing your own business account.

**Best for**: Phase 5 — tracking performance of content you post on your own pages.

**Required Steps to Access**:
1. Create a Meta for Developers account
2. Create a Facebook App
3. Request `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights` permissions
4. Link a Facebook Page to an Instagram Business Account
5. Submit app for review (can take days to weeks)

---

### Option C: Third-Party Research APIs

Several services provide Instagram data via clean REST APIs (they handle the scraping on their end).

| Service | Data Available | Cost | Notes |
|---|---|---|---|
| **Apify** | Reels, profiles, hashtags, engagement | ~$5–50/month | Most comprehensive; Instagram-specific scrapers |
| **RapidAPI (Social Media scraper)** | Reels by hashtag, trending | Varies | Multiple providers, check limits |
| **Phyllo** | Creator analytics | Enterprise pricing | Focus on influencer metrics |
| **Influencer Marketing Hub** | Manual research tool | Free (limited) | Not programmatic |
| **Bright Data** | Raw scraping infrastructure | ~$500+/month | Premium, powerful |

**Best for**: Phase 2 — when we need reliable, high-volume daily data without maintaining our own scraper. Apify is the strongest recommendation.

---

### Option D: Instaloader (Python Library)

**What it does**: An open-source Python library that downloads public Instagram data (profiles, posts, hashtags) using Instagram's internal mobile API.

| Aspect | Details |
|---|---|
| **Coverage** | Public posts, hashtags, profile metadata, some engagement data |
| **Reliability** | Medium — depends on Instagram not changing internal API endpoints |
| **Speed** | Moderate |
| **Cost** | Free |
| **Maintenance** | Community-maintained; may lag on Instagram changes |
| **Legal Risk** | Medium — same ToS gray zone as Selenium |

**Best for**: Supplementary data collection; especially useful for downloading Reel metadata in bulk from hashtag feeds.

```python
import instaloader

L = instaloader.Instaloader()
# Download posts from a hashtag
for post in instaloader.Hashtag.from_name(L.context, 'personalfinance').get_posts():
    print(post.shortcode, post.likes, post.video_view_count, post.caption)
    if post.is_video:
        # Access video metadata
        pass
```

---

## 3. Recommended Hybrid Strategy

### Phase 1 (MVP — Weeks 1–4)
**Use: Selenium + Instaloader**

- Use `undetected-chromedriver` to search Instagram Reels by niche keyword
- Use `Instaloader` to bulk-pull hashtag posts with engagement data
- Store everything in SQLite
- Manual validation of 50–100 Reels to check data accuracy

### Phase 2 (Automation — Weeks 5–10)
**Use: Apify Instagram Scraper API**

- Set up Apify actor for daily hashtag scraping
- Route results into PostgreSQL (upgrade from SQLite)
- Schedule with cron or Apify's built-in scheduler
- Retire Selenium scraper (maintenance burden too high at scale)

### Phase 5 (Own Page Analytics)
**Use: Instagram Graph API**

- Track performance of content we post on our own business pages
- Pull retention curves, reach, impressions, saves, shares
- Feed back into the AI's formula-refinement loop

---

## 4. Legal and Ethical Considerations

> [!IMPORTANT]
> Instagram's Terms of Service prohibit automated scraping of their platform. However, collecting publicly available information for research purposes is a legal gray area in many jurisdictions. This project should take the following precautions:

### What We're Doing That's Low-Risk
- Collecting only **publicly visible** data (no private accounts, no DMs)
- **Not redistributing** scraped content
- Using data to **train our own AI models**, not to republish Instagram's content
- **Not copying videos** — only metadata (captions, metrics, IDs)

### Best Practices
1. **Respect `robots.txt`** — even when scraping, check what Instagram disallows
2. **Rate limit all requests** — never hammer the server; act like a human browser
3. **Use a dedicated account** — don't risk a personal or primary business account
4. **Store minimal data** — only what's needed for analysis
5. **Don't republish raw data** — the output of this pipeline is AI-generated ideas, not raw Instagram content
6. **Consider using Apify** — by Phase 2, using a third-party service that handles compliance is safer

### IP / Copyright
- **Video content** itself is copyrighted. We do **not** download or store videos.
- **Captions and metadata** are stored for analysis only, not redistribution.
- **AI-generated output** (remix ideas) is original — we're modeling structure, not copying content.

---

## 5. Data Flow Diagram

```
Instagram (Public)
        │
        ├── Selenium scraper ────────────────────────────┐
        │   (Phase 1, Reel URLs + page data)             │
        │                                                 │
        └── Instaloader ──────────────────────────────────┤
            (Phase 1, hashtag metadata)                   │
                                                          ▼
                                              ┌─────────────────────┐
                                              │  Raw Data Parser    │
                                              │  - Extract fields   │
                                              │  - Validate data    │
                                              │  - Normalize niche  │
                                              └──────────┬──────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │   SQLite DB (MVP)   │
                                              │   → PostgreSQL (v2) │
                                              └──────────┬──────────┘
                                                         │
                                         ┌───────────────┼───────────────┐
                                         ▼               ▼               ▼
                                    CSV Export      AI Analysis    Report Dashboard
                                    (Phase 1)       (Phase 3)      (Phase 2+)
```

---

## 6. Key Questions to Answer in Phase 1 Testing

- [ ] Can we reliably extract view counts from public Reel pages?
- [ ] Does Instaloader return `video_view_count` for Reels, or only likes?
- [ ] How quickly do we get IP-blocked without proxies?
- [ ] Is audio/sound metadata accessible from the Reel HTML metadata or requires separate request?
- [ ] Does the "posted date" resolve accurately enough to filter by 7–14 days?
- [ ] Can we detect whether a Reel has subtitles from page data?

---

## 7. Tooling Setup Checklist

- [ ] Install Python 3.11+ virtual environment
- [ ] Install `undetected-chromedriver` + matching ChromeDriver version
- [ ] Create a dedicated Instagram account for scraping research
- [ ] Set up `.env` with:
  - `INSTAGRAM_USERNAME`
  - `INSTAGRAM_PASSWORD`
  - `OPENAI_API_KEY`
  - `DB_PATH` (e.g., `./data/reels.db`)
- [ ] Test Instaloader login flow
- [ ] Confirm Selenium can load and scroll an Instagram Reels search page
- [ ] Sign up for Apify (free tier) to evaluate for Phase 2
