# Uptime Monitoring Runbook

**Status:** Code-complete — configure monitors in your chosen provider after first deploy.

---

## Overview

YourApp uses external uptime monitoring to alert on-call staff within minutes of any outage.
Two tiers of checks are configured:

| Check | URL | Interval | Alert threshold |
|-------|-----|----------|-----------------|
| Health | `https://your-app.com/api/health` | 1 min | 2 consecutive failures |
| Readiness | `https://your-app.com/api/ready` | 1 min | 2 consecutive failures |
| Homepage | `https://your-app.com` | 5 min | 2 consecutive failures |
| Checkout | `https://your-app.com/pricing` | 5 min | 2 consecutive failures |

---

## Recommended Providers

### Better Uptime (recommended — free tier available)

1. Sign up at [betteruptime.com](https://betteruptime.com)
2. **Monitors → New monitor** for each URL above
3. Set **check frequency: 1 minute** for `/api/health`, **5 minutes** for pages
4. Set **confirmation period: 2 checks** (avoids flappy alerts)
5. **Alert policy:** Page on-call via email + Slack + PagerDuty (if configured)
6. Enable **SSL expiry alerts** (30-day warning)

### Pingdom (alternative)

1. Sign up at [pingdom.com](https://pingdom.com)
2. Add uptime checks for each URL
3. Set alerting contacts (email, Slack webhook)

### UptimeRobot (free tier)

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Create HTTP monitors for each URL
3. Set notification contacts

---

## Incident Alert Flow

```
External monitor detects failure
        ↓
Sends alert to on-call email + Slack #alerts channel
        ↓
On-call engineer acknowledged within 5 minutes
        ↓
Follows incident-response.md
```

---

## Status Page

Create a public status page (Better Uptime and UptimeRobot both provide hosted pages).
Link it from the footer and `support@your-app.com` email signature.

---

## Verifying After First Deploy

```bash
# Manual health check
curl -f https://your-app.com/api/health
curl -f https://your-app.com/api/ready

# Expected: HTTP 200 with JSON body
```

---

## See Also

- `incident-response.md` — what to do when an alert fires
- `rollback.md` — how to revert a bad deploy
- `on-call.md` — rotation schedule and escalation
