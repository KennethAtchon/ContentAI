# Railway Frontend Deployment Guide

Deploying a Vite + React SPA to Railway via Docker.

---

## How Railway Works (the key constraint)

Railway injects a dynamic `$PORT` environment variable into every container. Your server **must** bind to `$PORT` — Railway's proxy won't find it otherwise. This is why every approach below has explicit `$PORT` handling.

---

## Approach Comparison

| | nginx | Caddy | node + serve |
|---|---|---|---|
| Image size | ~5 MB | ~10 MB | ~200 MB |
| PORT handling | Manual (envsubst) | Native (`{$PORT:8080}`) | Native (`process.env.PORT`) |
| SPA routing | `try_files` | built-in | built-in |
| Asset caching | Full control | Good | Limited |
| Production maturity | 20+ years | 7+ years | Not recommended |
| Config complexity | Moderate | Low | Low |

**Winner: nginx** for control and image size. **Caddy** if you want simpler config with no envsubst needed.

---

## Option A — nginx (current, recommended)

### Why

- Smallest image (~5 MB base)
- Maximum control over caching headers
- `try_files` handles SPA routing perfectly
- Used in production by millions of apps

### Dockerfile (production stage only)

```dockerfile
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

CMD ["/bin/sh", "-c", "PORT=${PORT:-8080} envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
```

### nginx.conf

```nginx
server {
    listen $PORT;

    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Force index.html revalidation on every request
    location ~ ^/index\.html$ {
        expires 0;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Cache hashed assets forever (Vite adds content hashes to filenames)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### How envsubst works

```
nginx.conf template has:  listen $PORT;
Railway injects:          PORT=8080
envsubst '$PORT' replaces ONLY $PORT — nginx's own $uri, $host etc. are untouched
Result:                   listen 8080;
```

The single quotes around `'$PORT'` are critical — they tell the shell to pass `$PORT` as a literal string to envsubst, not expand it. envsubst then uses it as a filter: only substitute variables named `PORT`.

---

## Option B — Caddy (simpler, no envsubst needed)

### Why consider it

Caddy natively reads `{$PORT:8080}` (env var with fallback) in its config. No shell scripting required. Railway's own docs recommend it for static sites.

### Dockerfile (production stage only)

```dockerfile
FROM caddy:2-alpine AS production

COPY --from=builder /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile
```

### Caddyfile

```
0.0.0.0:{$PORT:8080} {
    root * /usr/share/caddy
    encode gzip

    # Cache hashed assets forever
    @hashed {
        path_regexp hashed \.[a-f0-9]{8,}\.(js|css|woff2?)$
    }
    header @hashed Cache-Control "public, max-age=31536000, immutable"

    # index.html — always revalidate
    header /index.html Cache-Control "no-cache, no-store, must-revalidate"

    # SPA routing + static file server
    try_files {path} /index.html
    file_server
}
```

### Trade-offs vs nginx

- Slightly larger image (~10 MB)
- No envsubst complexity
- Less granular cache control (but enough for most cases)
- Caddy handles gzip automatically

---

## railway.toml

```toml
[build]
dockerfile = "Dockerfile"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

Do **not** add `startCommand` here — let the Dockerfile `CMD` handle it. A `startCommand` in railway.toml overrides the Dockerfile CMD and has caused issues.

---

## Build-time env vars (VITE_*)

Vite bakes env vars into the bundle at build time. They must be passed as Docker build `ARG`s:

```dockerfile
ARG VITE_API_URL
ARG VITE_FIREBASE_API_KEY
# etc.

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY

RUN bun run build
```

Set these in Railway under **Service → Variables** and configure them as build arguments. They are **not** available at runtime — only during `bun run build`.

---

## Common Railway Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| Healthcheck fails | Server bound to wrong port | Always use `$PORT` |
| `$uri` replaced in nginx config | envsubst replacing all vars | Use `envsubst '$PORT'` (single quotes) |
| `Script not found` error | `bun run <script>` echoes to stderr | Call the binary directly, not via `bun run` |
| VITE_ vars undefined at runtime | Baked at build time, not runtime | Pass as Docker ARG during build |
| `startCommand` in railway.toml ignored | Wrong TOML section (`[[services]]`) | Put `startCommand` under `[deploy]` |
| 404 on page refresh | No SPA fallback | `try_files $uri $uri/ /index.html` |

---

## Caching strategy explained

Vite outputs filenames with content hashes: `main-a1b2c3d4.js`. When code changes, the hash changes, the filename changes, and the browser fetches a fresh file. This means:

- **JS/CSS/fonts/images** → cache forever (`immutable`) — safe because filename changes on update
- **index.html** → never cache — this is what tells the browser about new filenames

This is why explicit `no-cache` on `index.html` matters: without it, users may load a stale HTML file that references old (or nonexistent) asset filenames.
