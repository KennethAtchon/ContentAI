# Cloudflare Setup Guide

**Last updated:** Feb 21, 2026  
**Stack:** Railway (origin) → Cloudflare (proxy/CDN) → users  
**Related:** [Deployment Runbook](./deployment.md)

---

## Architecture

```
User → Cloudflare (DNS + proxy + CDN) → Railway app (https://<project>.up.railway.app)
         ↑ your domain (yourdomain.com)        ↑ origin, not exposed directly
```

Cloudflare terminates TLS for users. The Railway origin has its own SSL certificate (auto-managed by Railway). Traffic between Cloudflare and Railway is also encrypted.

---

## 1. DNS Configuration

In Cloudflare DNS → your domain:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| `CNAME` | `@` (root) | `<project>.up.railway.app` | ✅ Proxied (orange cloud) |
| `CNAME` | `www` | `<project>.up.railway.app` | ✅ Proxied (orange cloud) |

**Notes:**
- Keep the proxy **on** (orange cloud). This routes traffic through Cloudflare, enabling DDoS protection, caching, and `CF-Connecting-IP`.
- If you need to bypass Cloudflare temporarily (e.g. to debug), switch to DNS-only (grey cloud).
- Railway generates the domain `<project>.up.railway.app` in: Railway Dashboard → your service → Settings → Domains.

---

## 2. SSL/TLS Settings

Cloudflare Dashboard → SSL/TLS → Overview:

- **Mode:** Set to **Full (Strict)**
  - "Full" encrypts Cloudflare → Railway but doesn't verify Railway's cert.
  - "Full (Strict)" verifies Railway's cert — use this since Railway provides a valid certificate.
  - Never use "Flexible" — it sends plaintext between Cloudflare and Railway.

Cloudflare Dashboard → SSL/TLS → Edge Certificates:

- **Always Use HTTPS:** ✅ Enable — redirects HTTP → HTTPS at Cloudflare's edge.
- **Minimum TLS Version:** TLS 1.2 (or 1.3 if your user base allows it).
- **Automatic HTTPS Rewrites:** ✅ Enable — rewrites `http://` links in HTML to `https://`.
- **HSTS:** Enable with `max-age=31536000`, `includeSubDomains`, and `preload` once you're confident your domain and all subdomains support HTTPS.
  > **Warning:** HSTS preload is irreversible for 1 year. Only enable after confirming everything works.

---

## 3. IP Address Handling

With Cloudflare proxying, Railway only sees Cloudflare's IP, not the real client IP.

**Cloudflare automatically sends the real client IP via the `CF-Connecting-IP` header.** The app already reads this header in `shared/services/request-identity/request-identity.ts` — `getSecurityIp` checks `cf-connecting-ip` first.

**In Cloudflare Dashboard → Network:**
- **Pseudo IPv4:** Set to "Add +X-Forwarded-For header" or leave off — the app uses `cf-connecting-ip` as the primary source.

**Verify after deployment** by calling the debug IP endpoint (if you have one) or checking logs for `"source": "CloudFlare"` in the `Security IP detected` log entries.

---

## 4. Caching Rules

Cloudflare Dashboard → Caching → Configuration:

- **Browser Cache TTL:** Respect existing headers — the app sets its own `Cache-Control` headers in `next.config.ts`.
- **Caching Level:** Standard.

**Cache rules to add** (Cloudflare Dashboard → Rules → Cache Rules):

| Rule | Match | Action |
|------|-------|--------|
| Cache static assets | `URI path starts with /_next/static/` | Cache everything; Edge TTL: 1 year |
| Cache Next.js image optimized | `URI path starts with /_next/image/` | Cache everything; Edge TTL: 1 day |
| Bypass cache for API | `URI path starts with /api/` | Bypass cache |
| Bypass cache for auth pages | `URI path starts with /sign-in` or `/sign-up` | Bypass cache |

---

## 5. Security Settings

Cloudflare Dashboard → Security:

- **Bot Fight Mode:** ✅ Enable — blocks known bots at Cloudflare's edge before they reach Railway.
- **Browser Integrity Check:** ✅ Enable.
- **Security Level:** Medium (or High if you see abuse).

Cloudflare Dashboard → WAF (Web Application Firewall):

- **Managed Rules:** Enable Cloudflare Managed Ruleset — catches OWASP Top 10 patterns at the edge.
- **Rate Limiting (Cloudflare):** Optional — the app has its own Redis-backed rate limiting, but Cloudflare rate limiting adds a layer before requests hit Railway.

---

## 6. Page Rules / Transform Rules

**Redirect www → non-www** (or vice versa) — pick one canonical form:

Cloudflare Dashboard → Rules → Redirect Rules:

```
If: hostname equals www.yourdomain.com
Then: Redirect to https://yourdomain.com$path (301)
```

---

## 7. Required GitHub Secrets

Add these in GitHub → your repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `RAILWAY_TOKEN` | Railway account token (Railway → Account Settings → Tokens) |
| `PRODUCTION_URL` | `https://yourdomain.com` |

---

## 8. Railway Domain Configuration

In Railway Dashboard → your service → Settings → Domains:

1. Add custom domain: `yourdomain.com`
2. Railway shows a CNAME target — use this in Cloudflare DNS (step 1 above).
3. Railway auto-provisions an SSL certificate via Let's Encrypt for the Railway subdomain.
4. The custom domain certificate is handled by Cloudflare (edge cert) + Railway (origin cert).

---

## 9. Verification Checklist

Run these after setting up Cloudflare and Railway:

- [ ] `curl -I https://yourdomain.com` shows `200 OK` and `cf-ray:` header (confirms Cloudflare proxy is active)
- [ ] `curl -I http://yourdomain.com` redirects to `https://` (Always Use HTTPS working)
- [ ] `curl https://yourdomain.com/api/health` returns `{"status":"ok"}` or similar
- [ ] `curl https://yourdomain.com/api/ready` returns `{"status":"ready"}` or similar
- [ ] Check Railway logs — `"source": "CloudFlare"` appears in IP detection logs for real requests
- [ ] SSL Labs test: [ssllabs.com/ssltest](https://www.ssllabs.com/ssltest/) shows A or A+
- [ ] Security headers: [securityheaders.com](https://securityheaders.com) — validate all headers including CSP
- [ ] Cloudflare Analytics showing requests (confirms traffic is proxied)
