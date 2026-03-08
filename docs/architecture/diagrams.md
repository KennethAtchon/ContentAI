# Architecture & Data Flow Diagrams

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client (Browser)"]
        Browser["Next.js App\n(React + RSC)"]
        FirebaseSDK["Firebase SDK\n(Auth + IndexedDB)"]
    end

    subgraph Cloudflare["Cloudflare Edge"]
        CF_DNS["DNS"]
        CF_WAF["WAF / Bot Protection"]
        CF_CDN["CDN / Cache"]
    end

    subgraph Railway["Railway (EU-West)"]
        subgraph App["App Service (Docker)"]
            NextJS["Next.js 15\n(App Router)"]
            Middleware["middleware.ts\n(Auth + CSP + Rate Limit)"]
            API["API Routes\n(/api/*)"]
            Prisma["Prisma ORM"]
        end
        PG["PostgreSQL\n(Users, Orders,\nFeatureUsage)"]
        Redis["Redis\n(Rate Limiting,\nCSRF Cache)"]
    end

    subgraph Google["Google Cloud"]
        Firebase["Firebase Auth\n(Identity)"]
        Firestore["Firestore\n(Subscriptions)"]
        FirebaseExt["Firebase Stripe\nExtension"]
    end

    subgraph Stripe["Stripe"]
        StripeAPI["Stripe API\n(Payments)"]
        Portal["Customer Portal"]
        Webhooks["Webhooks"]
    end

    Browser -->|HTTPS| CF_WAF
    CF_WAF --> CF_CDN
    CF_CDN -->|Proxy| NextJS
    Browser <-->|Firebase SDK| Firebase
    NextJS --> Middleware
    Middleware --> API
    API --> Prisma
    Prisma --> PG
    API --> Redis
    API -->|firebase-admin\nverifyIdToken| Firebase
    API -->|Firestore Admin| Firestore
    API -->|Stripe API| StripeAPI
    StripeAPI -->|Webhooks| FirebaseExt
    FirebaseExt --> Firestore
    FirebaseExt -->|Set stripeRole\ncustom claim| Firebase
    Browser -->|Stripe.js| Portal
```

---

## Authentication & Request Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant CF as Cloudflare
    participant MW as middleware.ts
    participant API as API Route
    participant FB as Firebase Admin
    participant DB as PostgreSQL

    U->>+CF: HTTPS Request + Bearer token
    CF->>+MW: Forward request
    MW->>MW: Check CSP / security headers
    MW->>MW: CSRF token validation (mutations)
    MW->>+API: Pass to route handler
    API->>API: Rate limit check (Redis)
    API->>+FB: verifyIdToken(token, checkRevoked=true)
    FB-->>-API: Decoded token (uid, stripeRole)
    API->>+DB: Prisma query
    DB-->>-API: Data
    API-->>-MW: JSON response
    MW-->>-CF: Response
    CF-->>-U: Response (with security headers)
```

---

## Data Flow Diagram

```mermaid
flowchart TD
    subgraph UserActions["User Actions"]
        Signup["Sign Up"]
        Login["Log In"]
        UseCalc["Use Calculator"]
        Subscribe["Subscribe"]
        CancelSub["Cancel Subscription"]
        DeleteAccount["Delete Account"]
        ExportData["Export Data (GDPR)"]
    end

    subgraph DataStores["Data Stores"]
        PG_Users["PostgreSQL\nusers table"]
        PG_Usage["PostgreSQL\nfeature_usage table"]
        PG_Orders["PostgreSQL\norders table"]
        FS_Subs["Firestore\nsubscriptions"]
        FB_Auth["Firebase Auth\n(tokens + claims)"]
        Stripe_DB["Stripe\n(billing data)"]
    end

    subgraph Processing["Processing"]
        Auth["Firebase Auth"]
        StripeExt["Firebase Stripe Extension"]
    end

    Signup -->|create user| PG_Users
    Signup -->|create account| FB_Auth
    Login -->|verify token| FB_Auth
    Login -->|update lastLogin| PG_Users

    UseCalc -->|store result| PG_Usage
    UseCalc -->|check tier| FB_Auth

    Subscribe -->|checkout session| Stripe_DB
    Subscribe -->|webhook| StripeExt
    StripeExt -->|sync subscription| FS_Subs
    StripeExt -->|set stripeRole claim| FB_Auth

    CancelSub -->|via Stripe Portal| Stripe_DB
    CancelSub -->|webhook update| FS_Subs

    DeleteAccount -->|soft delete| PG_Users
    DeleteAccount -->|revoke tokens| FB_Auth
    DeleteAccount -->|hard delete after 30d| PG_Users

    ExportData -->|read all| PG_Users
    ExportData -->|read all| PG_Usage
    ExportData -->|read all| PG_Orders
    ExportData -->|return JSON| UserActions
```

---

## Subscription Tier Access Control

```mermaid
flowchart LR
    Token["Firebase ID Token\n(stripeRole claim)"]
    Token --> Free["free\nor null"]
    Token --> Pro["pro"]
    Token --> Enterprise["enterprise"]

    Free -->|mortgage, loan| Calc["Calculator Access"]
    Pro -->|+ investment, retirement| Calc
    Enterprise -->|all features\n+ higher limits| Calc

    subgraph FEATURE_TIER_REQUIREMENTS["Tier Requirements (permission matrix)"]
        Calc
    end
```

---

## Deployment Pipeline

```mermaid
flowchart LR
    Dev["git push\nmaster"]
    Dev --> CI["GitHub Actions CI\n(lint → unit → integration → build → audit)"]
    CI -->|all checks pass| Deploy["Railway Deploy\n(Docker build)"]
    Deploy --> Migrate["prisma migrate deploy\n(on startup)"]
    Migrate --> Health["Health check\n/api/health"]
    Health -->|200 OK| Live["Production Live"]
    Health -->|fail| Rollback["Auto-rollback\n(Railway)"]
```
