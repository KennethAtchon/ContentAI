# Architecture & Data Flow Diagrams

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client (Browser)"]
        Browser["React SPA\n(Vite + TanStack Router)"]
        FirebaseSDK["Firebase SDK\n(Auth + Token Management)"]
    end

    subgraph Cloudflare["Cloudflare Edge"]
        CF_DNS["DNS"]
        CF_WAF["WAF / Bot Protection"]
        CF_CDN["CDN / Cache"]
    end

    subgraph Backend["Backend (Bun + Hono)"]
        subgraph API["API Service"]
            Hono["Hono Framework\n(/api/* routes)"]
            AuthMW["Auth Middleware\n(Firebase Token Verify)"]
            RateLimit["Rate Limiting\n(Redis)"]
            CSRF["CSRF Protection\n(Encrypted Tokens)"]
        end
        Drizzle["Drizzle ORM"]
    end

    subgraph Databases["Data Stores"]
        PG["PostgreSQL\n(Users, Reels,\nGeneratedContent, Queue)"]
        Redis["Redis\n(Rate Limiting,\nSession Cache)"]
    end

    subgraph Google["Google Cloud"]
        Firebase["Firebase Auth\n(Identity)"]
        Firestore["Firestore\n(Subscriptions)"]
        FirebaseExt["Firebase Stripe\nExtension"]
    end

    subgraph External["External Services"]
        StripeAPI["Stripe API\n(Payments)"]
        Claude["Anthropic Claude\n(AI Analysis & Generation)"]
        Portal["Customer Portal"]
        Webhooks["Webhooks"]
    end

    Browser -->|HTTPS + Auth Token| CF_WAF
    CF_WAF --> CF_CDN
    CF_CDN -->|Proxy| Hono
    Browser <-->|Firebase SDK| Firebase
    Hono --> AuthMW
    AuthMW --> RateLimit
    RateLimit --> CSRF
    CSRF --> Drizzle
    Drizzle --> PG
    RateLimit --> Redis
    AuthMW -->|firebase-admin\nverifyIdToken| Firebase
    Hono -->|Firestore Admin| Firestore
    Hono -->|Stripe API| StripeAPI
    Hono -->|Claude API| Claude
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
    participant API as Hono API
    participant Auth as Auth Middleware
    participant RL as Rate Limiter
    participant FB as Firebase Admin
    participant DB as PostgreSQL
    participant AI as Claude AI

    U->>+CF: HTTPS Request + Bearer token
    CF->>+API: Forward request
    API->>+Auth: Verify authentication
    Auth->>+RL: Check rate limits
    RL->>+FB: verifyIdToken(token)
    FB-->>-RL: Decoded token (uid, stripeRole)
    RL-->>-Auth: Rate limit status
    Auth->>+DB: Drizzle query
    DB-->>-Auth: Data
    
    alt Studio API Request
        Auth->>+AI: Claude API call
        AI-->>-Auth: AI response
    end
    
    Auth-->>-API: Response
    API-->>-CF: JSON response
    CF-->>-U: Response (with security headers)
```

---

## Data Flow Diagram

```mermaid
flowchart TD
    subgraph UserActions["User Actions"]
        Signup["Sign Up"]
        Login["Log In"]
        DiscoverReels["Discover Reels"]
        AnalyzeReel["Analyze Reel"]
        GenerateContent["Generate Content"]
        ManageQueue["Manage Queue"]
        Subscribe["Subscribe"]
        CancelSub["Cancel Subscription"]
        DeleteAccount["Delete Account"]
        ExportData["Export Data (GDPR)"]
    end

    subgraph DataStores["Data Stores"]
        PG_Users["PostgreSQL\nusers table"]
        PG_Reels["PostgreSQL\nreels table"]
        PG_Analysis["PostgreSQL\nreel_analyses table"]
        PG_Generated["PostgreSQL\ngenerated_content table"]
        PG_Queue["PostgreSQL\nqueue_items table"]
        PG_Usage["PostgreSQL\nfeature_usage table"]
        PG_Orders["PostgreSQL\norders table"]
        FS_Subs["Firestore\nsubscriptions"]
        FB_Auth["Firebase Auth\n(tokens + claims)"]
        Stripe_DB["Stripe\n(billing data)"]
        Redis_Rate["Redis\n(rate limits)"]
    end

    subgraph Processing["Processing"]
        Auth["Firebase Auth"]
        StripeExt["Firebase Stripe Extension"]
        ClaudeAI["Claude AI\n(Analysis & Generation)"]
    end

    Signup -->|create user| PG_Users
    Signup -->|create account| FB_Auth
    Login -->|verify token| FB_Auth
    Login -->|update lastLogin| PG_Users

    DiscoverReels -->|query by niche| PG_Reels
    DiscoverReels -->|check rate limit| Redis_Rate
    
    AnalyzeReel -->|call Claude AI| ClaudeAI
    AnalyzeReel -->|store analysis| PG_Analysis
    AnalyzeReel -->|check usage| PG_Usage
    
    GenerateContent -->|call Claude AI| ClaudeAI
    GenerateContent -->|store content| PG_Generated
    GenerateContent -->|check tier limits| FB_Auth
    GenerateContent -->|update usage| PG_Usage
    
    ManageQueue -->|CRUD operations| PG_Queue
    ManageQueue -->|link content| PG_Generated

    Subscribe -->|checkout session| Stripe_DB
    Subscribe -->|webhook| StripeExt
    StripeExt -->|sync subscription| FS_Subs
    StripeExt -->|set stripeRole claim| FB_Auth

    CancelSub -->|via Stripe Portal| Stripe_DB
    CancelSub -->|webhook update| FS_Subs

    DeleteAccount -->|soft delete| PG_Users
    DeleteAccount -->|cascade delete| PG_Generated
    DeleteAccount -->|cascade delete| PG_Queue
    DeleteAccount -->|revoke tokens| FB_Auth
    DeleteAccount -->|hard delete after 30d| PG_Users

    ExportData -->|read all| PG_Users
    ExportData -->|read all| PG_Generated
    ExportData -->|read all| PG_Queue
    ExportData -->|read all| PG_Orders
    ExportData -->|return JSON| UserActions
```

---

## Subscription Tier Access Control

```mermaid
flowchart LR
    Token["Firebase ID Token\n(stripeRole claim)"]
    Token --> Free["free\nor null"]
    Token --> Basic["basic"]
    Token --> Pro["pro"]
    Token --> Enterprise["enterprise"]

    Free -->|5 scans/day, 2 analysis, 1 gen| Studio["Studio Access"]
    Basic -->|25 scans, 10 analysis, 10 gen| Studio
    Pro -->|Unlimited scans/analysis, 50 gen| Studio
    Enterprise -->|Everything unlimited\n+ team workspace| Studio

    subgraph FEATURE_TIER_REQUIREMENTS["ReelStudio Tier Limits"]
        Studio
        ReelScans["Reel Scans/Day"]
        Analysis["AI Analysis/Day"]
        Generation["Content Generation/Day"]
        Queue["Queue Size"]
        Instagram["Instagram Publishing"]
        
        Free --> ReelScans
        Free --> Analysis
        Free --> Generation
        Free --> Queue
        
        Basic --> ReelScans
        Basic --> Analysis
        Basic --> Generation
        Basic --> Queue
        
        Pro --> ReelScans
        Pro --> Analysis
        Pro --> Generation
        Pro --> Queue
        Pro --> Instagram
        
        Enterprise --> ReelScans
        Enterprise --> Analysis
        Enterprise --> Generation
        Enterprise --> Queue
        Enterprise --> Instagram
    end
```

---

## Deployment Pipeline

```mermaid
flowchart LR
    Dev["git push\nmain"]
    Dev --> CI["GitHub Actions CI\n(lint → unit → integration → build → audit)"]
    CI -->|all checks pass| Deploy["Deploy to Production\n(Railway / Docker)"]
    Deploy --> Migrate["bun db:migrate\n(Drizzle, on startup)"]
    Migrate --> Seed["Seed niches/reels\n(if needed)"]
    Seed --> Health["Health check\n/api/health"]
    Health -->|200 OK| Live["Production Live"]
    Health -->|fail| Rollback["Auto-rollback"]
```
