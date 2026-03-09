# CDN, Compression & HTTP/2 Configuration

**Item 53 — Feb 21, 2026**

---

## Status

| Feature | Status | Where configured |
|---------|--------|-----------------|
| Gzip/Brotli compression | ✅ Enabled | `next.config.ts` (`compress: true`) + Cloudflare |
| HTTP/2 | ✅ Enabled | Cloudflare (automatic for all proxied traffic) |
| HTTP/3 (QUIC) | ✅ Enabled | Cloudflare → Enable in Dashboard → Speed → Optimization → HTTP/3 |
| Static asset CDN | ✅ Enabled | Cloudflare caches `/_next/static/*` at the edge |
| Image CDN | ✅ Enabled | Next.js Image Optimization + WebP/AVIF conversion |
| Edge caching for pages | Partial | Next.js `revalidate = 3600` on public pages |

---

## Cloudflare CDN Setup

Cloudflare automatically caches static assets when the domain is proxied through Cloudflare (orange cloud).

### Cache Rules (Cloudflare Dashboard → Rules → Cache Rules)

Create these rules to cache static assets aggressively:

**Rule 1 — Static assets (immutable)**
```
IF: URI path matches /_next/static/*
THEN: Cache everything, Edge TTL: 1 year, Browser TTL: 1 year
```

**Rule 2 — Next.js images**
```
IF: URI path matches /_next/image*
THEN: Cache everything, Edge TTL: 7 days, Browser TTL: 1 day
```

**Rule 3 — Public assets**
```
IF: URI path matches /images/* OR /fonts/*
THEN: Cache everything, Edge TTL: 30 days, Browser TTL: 7 days
```

**Rule 4 — Public pages (ISR)**
```
IF: URI path matches /pricing OR /faq OR /about OR /features
THEN: Cache everything, Edge TTL: 1 hour, Browser TTL: 5 minutes
```

### Speed Optimizations (Cloudflare Dashboard → Speed → Optimization)

Enable:
- ✅ **Auto Minify** (HTML, CSS, JS)
- ✅ **Brotli** compression
- ✅ **HTTP/2**
- ✅ **HTTP/3 (QUIC)**
- ✅ **Early Hints** (103 responses for faster LCP)
- ✅ **Rocket Loader** — test first; may interfere with Firebase SDK loading

---

## Next.js Compression

`compress: true` in `next.config.ts` enables Gzip compression for the Next.js server.
Cloudflare's Brotli compression applies on top at the edge for better compression ratios.

---

## Cache Headers Already Set

From `next.config.ts`:

| Path | Cache-Control |
|------|---------------|
| `/images/*` | `public, max-age=31536000, immutable` |
| `/_next/static/*` | `public, max-age=31536000, immutable` |
| `/_next/image/*` | `public, max-age=31536000, immutable` |
| `/api/static/*` | `public, max-age=3600, s-maxage=3600` |

---

## PWA Support

**Item 54 — Decision: Not applicable at this time.**

YourApp is a SaaS web application, not a Progressive Web App. PWA features (service worker, offline support, app manifest install) would only add value if:
- Users need offline access to generator results
- Mobile install-to-homescreen is a priority

**Revisit:** If product pivots to mobile-first or offline use cases.

---

## Auto-Scaling

**Item 55 — Railway handles scaling automatically.**

Railway's autoscaling configuration:

```toml
# railway.toml (already configured)
[deploy]
numReplicas = 1  # Increase to 2+ for horizontal scaling on Railway Pro
```

To enable horizontal scaling:
1. Railway Dashboard → Service → Settings → Replicas
2. Set minimum and maximum replica counts
3. Railway scales based on CPU/memory thresholds automatically

**Current status:** Single replica sufficient for launch. Enable multi-replica after first 1,000 active users.

---

## See Also

- `cloudflare-setup.md` — full Cloudflare DNS and proxy setup
- `deployment.md` — Railway deployment configuration
- `alerting.md` — performance alerts
