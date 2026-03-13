# Instagram Headless Browser Reel Extraction

Research into building a self-hosted headless browser scraper for Instagram reels as an alternative to the current Apify integration.

**Date:** 2026-03-12
**Status:** Research
**Related:** `backend/src/services/scraping.service.ts`, `backend/src/services/queue.service.ts`

---

## Current Architecture (Apify)

The existing scraper uses Apify's `instagram-hashtag-scraper` actor:

- **Entry point:** `POST /api/admin/niches/:id/scan` enqueues a `ScrapeJob` via `queueService`
- **Queue:** In-memory queue with Redis persistence for job state (24h TTL). Single worker processes one job at a time.
- **Scraping:** `scrapingService.scrapeNiche()` calls `apify~instagram-hashtag-scraper` with `resultsLimit: 100`
- **Polling:** 3s interval, 40 max attempts (~2-minute window)
- **Retry:** 3 attempts, exponential backoff (2s / 4s / 8s)
- **Post-processing:** Fire-and-forget R2 upload of video (`video/<externalId>.mp4`) and audio (`audio/<externalId>.m4a`)
- **Deduplication:** `INSERT ... ON CONFLICT DO NOTHING` on `reels.externalId`
- **Cost:** ~$49/month (Apify Starter plan)

---

## Headless Browser Options

### Playwright vs Puppeteer

**Recommendation: Playwright** — better fit for this project.

| Factor | Playwright | Puppeteer |
|--------|-----------|-----------|
| TypeScript support | Native (matches project stack) | Good |
| Multi-browser | Chromium, Firefox, WebKit | Chromium only |
| Context isolation | Full (separate cookies, cache, storage per context) | Requires new browser process |
| Anti-detection ecosystem | `playwright-extra` + stealth plugin port | `puppeteer-extra-plugin-stealth` (canonical) |
| Network interception | First-class `page.route()` and `page.on("response")` | Good |
| Fingerprint diversity | WebKit reduces Chrome-specific detection | Chrome-only fingerprint |

The stealth plugin patches `navigator.webdriver`, strips `"HeadlessChrome"` from User-Agent, spoofs WebGL vendor strings, fakes plugin arrays, and patches `chrome.runtime`. These buy evasion time but are not permanent — Instagram's ML-based detection analyzes 60+ signals simultaneously.

**Key setup:** Use Chromium in `headless: false` mode (headful via Xvfb) because headless mode has measurably different Canvas/WebGL fingerprints.

---

## Reel Extraction Techniques

Three approaches, ranked by stability:

### Approach A: Network Request Interception (Most Robust)

The most stable technique — does not rely on DOM selectors. Navigate to the hashtag page and intercept the underlying GraphQL/API calls the Instagram web app makes:

```typescript
page.on("response", async (response) => {
  const url = response.url();
  if (url.includes("graphql/query") && url.includes("tag_media")) {
    const json = await response.json();
    // extract reel data from the response shape
  }
});
```

Instagram's web app communicates with `https://www.instagram.com/graphql/query/` using `doc_id` values identifying specific query types. The intercepted JSON contains all needed fields: video URL, thumbnail, caption, likes, comments, views, audio metadata, poster username.

**Caveat:** The `doc_id` for hashtag/reel queries changes every 2-4 weeks. The interception approach partially mitigates this (you intercept whatever `doc_id` the current page uses), but the response JSON shape may also change.

### Approach B: DOM Scraping with Stable Selectors

Navigate to `https://www.instagram.com/explore/tags/<hashtag>/` and extract reel cards from the rendered DOM. Instagram uses dynamically generated CSS class names (e.g., `x9f2g1z`) that change every deployment.

**Use structural/semantic selectors instead:**
- `article[role]` — article elements with ARIA roles
- `a[href*="/reel/"]` — links containing `/reel/` in the href
- `video[src]` — direct video elements
- `[data-testid]` attributes — change less frequently than CSS classes
- `time[datetime]` — timestamp elements

**This approach is fragile and should only be used as a fallback.**

### Approach C: Direct GraphQL API Replay (No Browser)

Establish a browser session once to capture cookies/headers, then replay the underlying API calls directly:

```
POST https://www.instagram.com/graphql/query/
Headers: X-IG-App-ID, X-CSRFToken, X-Requested-With, Cookie (session)
Body: variables={"tag_name":"fitness","first":50}&doc_id=25981206651899035
```

Avoids full browser overhead but requires maintaining a live session. Sessions are actively invalidated by Instagram when they detect bot-like request patterns.

### Video URL Constraints

Instagram CDN video URLs (`https://scontent-*.cdninstagram.com/v/...`) are:
- **Time-limited:** Expire within 1-6 hours
- **IP-bound:** HMAC signature tied to the requesting IP/subnet
- **Immediate download required:** R2 upload must happen from the same server that scraped the page, within the validity window

---

## Anti-Detection and Rate Limiting

### Instagram's Detection Stack

Instagram analyzes 60+ signals concurrently using ML models:

**Network-level:**
- IP reputation (datacenter ASNs blocked immediately — AWS, GCP, Azure, Railway, DigitalOcean)
- Request frequency per IP (empirical limit: ~200 req/hr; safe sustained: <50/hr)
- HTTP/2 fingerprinting (browser vs. non-browser TLS handshake)
- Missing/inconsistent `Accept`, `Accept-Language`, `Accept-Encoding` headers

**Browser fingerprint:**
- `navigator.webdriver === true` (patched by stealth plugin)
- Canvas 2D/WebGL fingerprint mismatches vs. declared GPU
- Empty browser plugins array (real Chrome has plugins)
- `window.chrome.runtime` absence
- `performance.timing` anomalies

**Behavioral:**
- Mouse movement patterns (uniform linear vs. natural curved motion)
- Scroll velocity (instant vs. gradual)
- Time-on-page distributions
- No prior session history / no cookies from previous visits
- Perfect request timing (no jitter)

### Empirical Rate Limits

| IP Type | Requests Before Block | Safe Daily Volume |
|---------|----------------------|-------------------|
| Datacenter IPs | Blocked immediately | Not viable |
| Residential (no warm-up) | 50-100 | ~200 |
| Residential (warm-up + delays) | 200-500 | 300-500 |
| Mobile proxies (warm-up) | 500+ | 500+ |

**Key parameters:**
- Safe inter-request delay: 2-8 seconds with random jitter
- Scraping without login triggers IP-level temporary blocks (30-60 min cooldown)
- Scraping with login triggers account-level actions (restriction → shadowban → permanent ban)
- **For read-only public data, operating without login is preferable** — limits damage to IP-level blocks

---

## Proxy Strategy

### Proxy Type Hierarchy (Best to Worst)

1. **Mobile (4G/5G) proxies:** Highest trust. Mobile IPs shared among thousands of real users. $50-150/GB. Providers: Bright Data Mobile, SOAX, ProxyEmpire.

2. **Residential proxies:** Real consumer ISP addresses. Standard for Instagram scraping. $2-15/GB. Providers: Bright Data (72M IPs), Decodo/Smartproxy, NetNut (85M IPs), DataImpulse.

3. **Static ISP proxies:** Datacenter IPs assigned to residential ISP ASN blocks. Faster than true residential, cheaper than mobile. Good for stable session maintenance.

4. **Datacenter proxies:** Banned instantly. Not viable for Instagram.

### Rotation Strategy

- Assign one proxy per browser context (not per request) for session coherence
- Rotate proxies between scraping sessions (between niche runs), not mid-session
- Use sticky sessions: same IP for a full niche scrape (~10-15 min)
- After soft-block (HTTP 429 or challenge page), retire IP for 30+ minutes
- Warm-up period: navigate to 2-3 Instagram pages at human speed before requesting hashtag feeds

### Cost Estimate

Assuming 10 niche scrapes/day, 100 reels/niche, 2-3 page requests/reel:
- ~2,000-3,000 residential proxy requests/day
- ~600MB/day at ~$3/GB = **~$54/month** for proxies alone

---

## Scalability Architecture

### Recommended: Separate Scraping Microservice

Do not embed browser processes in the Hono backend. A single Chromium instance uses 200-400MB RAM.

```
Backend (Hono) → Redis Queue → Scraping Microservice (Playwright)
                                      ↓
                               Browser Process Pool
                                      ↓
                                 Proxy Pool
```

### Browser Context Pool Design

```
Browser Process 1: Context A (proxy1), Context B (proxy2), Context C (proxy3)
Browser Process 2: Context D (proxy4), Context E (proxy5)
```

- Pool size: 2 browser processes, up to 3 contexts each (6 max concurrent scrapes)
- Context lifecycle: create fresh context per job, destroy after completion
- Browser restart: recycle process after 50 contexts to prevent memory leaks
- Resource requirement: ~1-2GB RAM for the scraper service

### Integration with Existing Queue

The scraper service exposes: `POST /scrape { hashtag: string, limit: number }` → returns `ApifyReelItem[]`

`scraping.service.ts` gains a `REEL_SOURCE` env var switch:
- `"apify"` (default): current Apify path
- `"browser"`: calls scraper microservice

Response shape matches `ApifyReelItem` exactly — zero changes downstream.

---

## Resilience Patterns

### Error Recovery

```typescript
try {
  result = await interceptNetworkResponse(page, hashtag);
} catch (NetworkInterceptError) {
  // doc_id changed or response shape changed
  result = await fallbackDOMExtraction(page, hashtag);
  // alert: doc_id may need update
}
```

### Challenge/Block Detection

After navigation, check:
- `page.url().includes("/accounts/login")` → login wall
- HTTP 429 responses → rate limited
- CAPTCHA/challenge page detected → mark proxy as cooling down

On any block: retire proxy for 30+ min, rotate to fresh proxy+context, retry.

### Monitoring

Run weekly test against a known stable public hashtag. If the test returns zero items, the `doc_id` has rotated or Instagram has changed the response shape. Alert before production runs degrade.

---

## Legal and Ethical Considerations

### Legal Status (US, March 2026)

- **hiQ Labs v. LinkedIn (2022):** Scraping publicly accessible data does not constitute "unauthorized access" under CFAA
- **Legal:** Scraping public Instagram posts/reels visible without login
- **Legal gray area:** Scraping public content at scale for commercial purposes
- **Civil risk:** Violates Instagram ToS Section 4.1 (prohibits automated data collection) — contract dispute, not criminal, but exposes to cease-and-desist and injunctions
- **Illegal:** Creating fake accounts, bypassing CAPTCHAs, cracking tokens

### GDPR Implications

- Scraped data includes `username` (personal data under GDPR) and `caption` (may contain personal data)
- Requires lawful basis for processing (legitimate interests — requires Legitimate Interests Assessment)
- Current schema stores `username` and `caption` indefinitely — primary GDPR exposure
- No mechanism for Data Subject Access Requests (DSARs) or Article 17 deletion

### Best Practices

- Respect conservative rate limits well below Instagram's threshold
- Do not scrape private accounts
- Minimize personally identifiable information storage
- Do not sell or share raw scraped data

---

## Alternative Approaches

### Instagram Graph API (Official)

Basic Display API was retired December 2024. Graph API only works for Business/Creator accounts you own or have explicit permission to manage. **Cannot search hashtags for arbitrary public content. Not viable.**

### Meta oEmbed API

Only provides embed HTML for individual known URLs. Cannot be used for hashtag discovery. As of November 2025, no longer returns thumbnail or author metadata. **Not viable for discovery.**

### Third-Party Scraping APIs (Apify Alternatives)

| Service | Model | Notes |
|---------|-------|-------|
| Apify (current) | Pay-per-run | $49/mo starter |
| Bright Data Web Scraper | Pay-per-request | Very reliable, more expensive |
| ScraperAPI | Pay-per-request | Instagram-specific endpoints |
| Scrapfly | Credits-based | Good anti-bot bypass |
| Oxylabs Web Scraper API | Enterprise | Premium pricing |

All offload browser infrastructure and proxy management to the provider.

---

## Options Comparison

### Option A: Full Self-Hosted Headless Browser Scraper

Build a Playwright-based scraper in a dedicated service with stealth plugin, residential proxies, and network interception.

| Pros | Cons |
|------|------|
| No per-run third-party cost | Infrastructure: ~$74-104/month (service + proxies) vs Apify's $49/month |
| Full control over extraction logic | Operational burden: doc_id rotations every 2-4 weeks, stealth updates, proxy health |
| Can extract fields Apify doesn't provide | 10-30% failure rates requiring retry logic |
| Eliminates Apify polling latency | Chromium requires OS-level deps not in standard Bun containers |
| Better debugging (browser console, network logs) | More traceable ToS violation than using Apify |

### Option B: Direct GraphQL API Replay (Lightweight)

Capture session cookies periodically, replay API calls directly from the backend using `fetch`.

| Pros | Cons |
|------|------|
| Extremely low resource overhead | Session cookies invalidated within hours by Instagram |
| Millisecond execution vs seconds for browser | doc_id changes every 2-4 weeks |
| Can run within existing Hono backend | Direct HTTP fingerprint easily detected |
| Lower infrastructure cost | High maintenance without browser safety net |

### Option C: Switch Apify Alternative

Keep managed actor model, switch to a different provider for better pricing/reliability.

| Pros | Cons |
|------|------|
| Zero architectural change | Still third-party dependent |
| Managed infrastructure | Different response schemas require interface updates |
| Legal risk stays with provider | Must evaluate each provider's data quality |

### Option D: Multi-Source Hybrid (Recommended if self-hosting)

Keep Apify as primary, add self-hosted fallback for when Apify fails or rate-limits.

| Pros | Cons |
|------|------|
| Best resilience — two independent paths | Session maintenance for fallback still required |
| Minimal new infrastructure | More complex scraping.service.ts |
| Can be built incrementally | Two systems to maintain |

---

## Implementation Plan (If Proceeding with Option A)

### Service Structure

```
scraper/
├── src/
│   ├── index.ts                          # Hono HTTP server (POST /scrape)
│   ├── browser/
│   │   ├── pool.ts                       # Browser context pool manager
│   │   └── stealth.ts                    # Playwright + stealth plugin setup
│   ├── scrapers/
│   │   ├── instagram-hashtag.ts          # Network interception scraper
│   │   └── types.ts                      # ApifyReelItem-compatible output type
│   ├── proxy/
│   │   └── manager.ts                    # Proxy rotation + cooldown tracking
│   └── utils/
│       └── envUtil.ts                    # Environment variables
├── package.json
├── Dockerfile                            # Playwright system deps
└── __tests__/
```

### Backend Changes

**`scraping.service.ts`:** Add `scrapeViaInternalBrowser()` alongside existing Apify path, gated on `REEL_SOURCE` env var.

**`envUtil.ts`:** Add `REEL_SOURCE`, `SCRAPER_SERVICE_URL`, `SCRAPER_INTERNAL_SECRET`.

### Key Risk: CDN URL IP-Binding

If the scraper and backend are on different IPs (different Railway services), CDN URLs scraped by the scraper may be invalid when the backend tries to download them for R2 upload.

**Solution:** Download the video/audio inside the scraper service and either:
- Send binary data back in the response
- Upload directly to R2 from the scraper service

### Dockerfile

```dockerfile
FROM mcr.microsoft.com/playwright:v1.50.0-jammy
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
CMD ["bun", "run", "src/index.ts"]
```

### Environment Variables

```bash
# Backend
REEL_SOURCE=apify          # "apify" | "browser"
SCRAPER_SERVICE_URL=       # URL of scraper microservice
SCRAPER_INTERNAL_SECRET=   # Shared auth secret

# Scraper service
PROXY_LIST=                # Newline-separated proxy URLs
BROWSER_POOL_SIZE=2        # Number of browser processes
SCRAPER_INTERNAL_SECRET=   # Must match backend
```

---

## Recommendation

**Short term:** Keep Apify. At $49/month with managed infrastructure and existing clean integration, the risk/reward of self-hosting is negative at current scale.

**When to switch:** When Apify costs become prohibitive (Scale+ plan at hundreds/month), Apify reliability degrades, or custom extraction needs arise that Apify can't satisfy.

**If self-hosting is a hard requirement:** Proceed with Option A (full Playwright scraper) using:
1. Playwright + `playwright-extra` + stealth plugin
2. Network request interception (not DOM scraping)
3. Separate Railway service (not embedded in Hono backend)
4. Residential proxies (Bright Data or Decodo) with sticky session rotation
5. Headful mode via Xvfb
6. Same downstream pipeline (`queue.service.ts`, `storage/index.ts`, `schema.ts` unchanged)

**Estimated costs for self-hosted:** $74-104/month (scraper service $20-50 + proxies ~$54) vs. Apify's $49/month. The value proposition is control and customizability, not cost savings.
