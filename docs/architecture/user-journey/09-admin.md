# Admin Journeys

**Routes:** `/admin/*`
**Auth:** Required (`authType="admin"` — users without `role: "admin"` are redirected to home)
**Role elevation:** See [01-authentication.md](./01-authentication.md) — Admin Role Elevation section

---

## Admin Route Map

```
/admin/verify              — Role elevation (enter secret code)
/admin/dashboard           — Metrics overview
/admin/customers           — Customer CRUD
/admin/orders              — Order management
/admin/subscriptions       — Subscription analytics
/admin/niches              — Niche CRUD
/admin/niches/$nicheId     — Niche detail (reels, scrape history, analytics)
/admin/music               — Music library management
/admin/settings            — Admin's own profile settings
/admin/developer           — Developer tools
/admin/contactmessages     — Inbound contact form messages
/admin/system-config       — System-level configuration
```

---

## 1. Dashboard

**Entry:** `/admin/dashboard` (default after `/admin/`)

**What the admin sees:**
- Monthly Recurring Revenue (MRR) with trend
- Active Subscriptions count
- Average Revenue Per User (ARPU)
- Churn Rate
- Total Customers count (with % change vs. last month)
- Conversion Rate
- Total Revenue
- AI Cost Dashboard (per-model cost breakdown)
- Recent Orders (last 5) with link to `/admin/orders`
- Subscription summary with link to `/admin/subscriptions`

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend

    AD->>FE: Navigate to /admin/dashboard
    par Load metrics in parallel
        FE->>BE: GET /api/admin/subscriptions/analytics
        BE-->>FE: { mrr, activeCount, arpu, churnRate }
    and
        FE->>BE: GET /api/users/customers-count
        BE-->>FE: { total, changePercent }
    and
        FE->>BE: GET /api/admin/analytics
        BE-->>FE: { conversionRate }
    and
        FE->>BE: GET /api/customer/orders/total-revenue
        BE-->>FE: { totalRevenue }
    end
    FE->>FE: Render dashboard metrics
```

---

## 2. Customer Management

**Entry:** `/admin/customers`

**What the admin sees:**
- Search input (search by name or email)
- Three tabs: All / Active / Inactive
- Customer table: name, email, role, status, created date
- "Edit" button per row

**What the admin can do:**
- Search customers
- Filter by active/inactive status
- Edit customer details

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    AD->>FE: Navigate to /admin/customers
    FE->>BE: GET /api/users
    BE->>DB: SELECT * FROM users ORDER BY created_at DESC
    DB-->>BE: Customer list
    BE-->>FE: Customers
    FE->>FE: Render CustomersList table

    AD->>FE: Type in search box → Enter
    FE->>BE: GET /api/users?search=<term>
    BE-->>FE: Filtered results

    AD->>FE: Click "Edit" on a customer row
    FE->>FE: Open EditCustomerModal (name, email, phone, address)
    AD->>FE: Edit fields → Submit
    FE->>BE: PUT /api/users/:id { name, email, phone, address }
    BE->>DB: UPDATE users SET ... WHERE id=:id
    BE-->>FE: Updated customer
    FE->>FE: Update row in table
```

---

## 3. Order Management

**Entry:** `/admin/orders`

**What the admin sees:**
- Search + filter bar
- Paginated orders table: customer name, amount, status, date
- "Create Order" button
- "View Products" button per order

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    AD->>FE: Navigate to /admin/orders
    FE->>BE: GET /api/admin/orders
    BE->>DB: SELECT orders JOIN users ORDER BY created_at DESC
    DB-->>BE: Orders list
    BE-->>FE: Orders
    FE->>FE: Render orders table

    AD->>FE: Click "View Products" on an order
    FE->>FE: Open OrderProductsModal with line items

    AD->>FE: Click "Create Order" → Fill OrderForm
    FE->>BE: POST /api/admin/orders { userId, items, amount }
    BE->>DB: INSERT INTO orders ...
    BE-->>FE: New order
    FE->>FE: Append to table
```

---

## 4. Subscription Management

**Entry:** `/admin/subscriptions`

**What the admin sees:**
- Top metrics: active count, MRR, churn rate
- Subscriptions list table: customer, tier, billing cycle, status, period end
- Analytics charts: subscription growth, revenue trends over time

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend
    participant FS as Firestore

    AD->>FE: Navigate to /admin/subscriptions
    FE->>BE: GET /api/admin/subscriptions
    BE->>FS: Read customers/*/subscriptions (all users)
    FS-->>BE: All subscription documents
    BE-->>FE: [{ customerId, tier, billingCycle, status, currentPeriodEnd }]
    FE->>FE: Render SubscriptionsList table

    FE->>BE: GET /api/admin/subscriptions/analytics
    BE-->>FE: { mrr, churnRate, growthByMonth }
    FE->>FE: Render SubscriptionAnalytics charts
```

---

## 5. Niche Management

### 5a. Niche List Page

**Entry:** `/admin/niches`

**What the admin sees:**
- Table of all niches: ID, name, status (active/inactive), reel count
- Search filter + "Active Only" toggle
- "Create Niche" button

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    AD->>FE: Navigate to /admin/niches
    FE->>BE: GET /api/admin/niches
    BE->>DB: SELECT niches with reel count
    DB-->>BE: Niches
    BE-->>FE: Niches list
    FE->>FE: Render niches table

    AD->>FE: Click "Create Niche"
    FE->>FE: Open NicheFormModal (name, description, active toggle)
    AD->>FE: Fill form → Submit
    FE->>BE: POST /api/admin/niches { name, description, active }
    BE->>DB: INSERT INTO niches ...
    BE-->>FE: New niche
    FE->>FE: Append to table

    AD->>FE: Click edit icon on a niche
    FE->>FE: Open NicheFormModal pre-filled
    AD->>FE: Edit → Submit
    FE->>BE: PUT /api/admin/niches/:id { name, description, active }
    BE->>DB: UPDATE niches SET ...
    BE-->>FE: Updated niche

    AD->>FE: Click delete icon
    FE->>FE: Confirmation dialog
    AD->>FE: Confirm
    FE->>BE: DELETE /api/admin/niches/:id
    Note over BE: Only succeeds if niche has no associated reels
    BE->>DB: DELETE niches WHERE id=:id
    BE-->>FE: { success: true }
```

### 5b. Niche Detail Page (Reels Tab)

**Entry:** `/admin/niches/$nicheId` → Reels tab

**What the admin sees:**
- Reels table: hook, views, likes, engagement rate, duration, viral flag, has analysis, audio, caption, job ID, saved date
- Filters: All / Viral only / Non-viral / Has Video
- Sort by: views, likes, engagement, posted date, scraped date (with direction toggle)
- Checkboxes for bulk select
- Action buttons: "Trigger Scrape", "Run Dedupe", "Export", "Delete Selected"
- Eye icon per row to expand full reel detail

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant AP as Apify

    AD->>FE: Navigate to /admin/niches/3 (Reels tab)
    FE->>BE: GET /api/admin/niches/3/reels
    BE->>DB: SELECT reels WHERE niche_id=3
    DB-->>BE: Reels list
    BE-->>FE: Reels
    FE->>FE: Render reels table

    AD->>FE: Click "Trigger Scrape"
    FE->>FE: Open Scrape Options dialog
    Note over FE: Fields: Limit (1-10000), Min Views, Max Age (days), Viral only toggle
    Note over FE: Shows niche defaults as placeholder hints
    AD->>FE: Set options → Submit
    FE->>BE: POST /api/admin/niches/3/scan { limit, minViews, maxAgeDays, viralOnly }
    BE->>AP: Queue Apify scrape job
    AP-->>BE: { jobId }
    BE-->>FE: { jobId }
    FE->>FE: Show "Scan started" toast

    AD->>FE: Click "Run Dedupe"
    FE->>BE: POST /api/admin/niches/3/dedupe
    BE->>DB: Find and remove duplicate reels
    BE-->>FE: { removed: N }
    FE->>FE: Show "Removed N duplicates" toast

    AD->>FE: Click "Export"
    FE->>BE: GET /api/admin/niches/3/reels/export?format=csv
    BE-->>FE: CSV file download

    AD->>FE: Select reels via checkboxes → Click "Delete Selected"
    FE->>FE: Confirmation dialog (N reels selected)
    AD->>FE: Confirm
    FE->>BE: DELETE /api/admin/niches/3/reels { ids: [1,2,3] }
    BE->>DB: DELETE reels WHERE id IN (...)
    BE-->>FE: { deleted: N }
    FE->>FE: Remove deleted rows from table
```

### 5c. Niche Detail Page (History Tab)

**Entry:** `/admin/niches/$nicheId` → History tab

**What the admin sees:**
- List of all past scrape jobs: job ID, status (scanning/complete/failed), reels saved, reels skipped, duration, started time
- Running jobs show "Scanning…" spinner
- Completed jobs show "Scan complete — N saved, M skipped in Xs"

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    AD->>FE: Click "History" tab
    FE->>BE: GET /api/admin/niches/3/scrape-jobs
    BE->>DB: SELECT scrape_jobs WHERE niche_id=3 ORDER BY started_at DESC
    DB-->>BE: Jobs list
    BE-->>FE: Jobs
    FE->>FE: Render job history list
    Note over FE: Running jobs poll for updates every few seconds
```

---

## 6. Music Library Management

**Entry:** `/admin/music`

**What the admin sees:**
- Table: name, artist, mood, genre, duration, active/inactive status badge
- Search by track name
- "Upload Track" button

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend
    participant R2 as Cloudflare R2
    participant DB as PostgreSQL

    AD->>FE: Navigate to /admin/music
    FE->>BE: GET /api/admin/music
    BE->>DB: SELECT * FROM music_tracks ORDER BY created_at DESC
    DB-->>BE: Tracks
    BE-->>FE: Tracks list
    FE->>FE: Render music table

    AD->>FE: Click "Upload Track"
    FE->>FE: Open UploadModal
    Note over FE: Fields: MP3 file (drag-drop, max 10MB), track name*, artist, mood*, genre
    AD->>FE: Drop MP3 + fill fields → Submit
    FE->>BE: POST /api/admin/music (multipart form data)
    BE->>R2: Upload MP3 file
    R2-->>BE: { url }
    BE->>DB: INSERT INTO music_tracks { name, artist, mood, genre, url, active: true }
    DB-->>BE: New track
    BE-->>FE: Track created
    FE->>FE: Append to table

    AD->>FE: Click status badge to toggle active/inactive
    FE->>BE: PATCH /api/admin/music/:id/toggle
    BE->>DB: UPDATE music_tracks SET active=NOT active WHERE id=:id
    BE-->>FE: { active: false }
    FE->>FE: Update badge

    AD->>FE: Click delete icon → Confirm
    FE->>BE: DELETE /api/admin/music/:id
    BE->>DB: DELETE music_tracks WHERE id=:id
    BE-->>FE: { success: true }
    FE->>FE: Remove row
    Note over FE: Toast: "Existing user attachments will show 'track unavailable'"
```

---

## 7. Admin Settings (Profile)

**Entry:** `/admin/settings`

**What the admin sees:**
- Name field (editable)
- Email (read-only)
- Phone, Address fields
- Role (read-only display: "admin")
- Password change section: current, new, confirm

**Steps:**
1. Edit fields → Save → `PUT /api/customer/profile`
2. Password change flow (form-based; backend validates current password)

---

## 8. Contact Messages

**Entry:** `/admin/contactmessages`

**What the admin sees:**
- Table of all inbound contact form submissions
- Columns: name, phone, subject, message, received date
- Read-only; no reply/archive actions in UI

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    AD->>FE: Navigate to /admin/contactmessages
    FE->>BE: GET /api/admin/contact-messages
    BE->>DB: SELECT * FROM contact_messages ORDER BY created_at DESC
    DB-->>BE: Messages
    BE-->>FE: Messages list
    FE->>FE: Render messages table
```

---

## 9. System Config

**Entry:** `/admin/system-config`

**What the admin sees:**
- System-wide configuration panel
- Fields for: AI models, rate limit values, feature flags, and other global settings

```mermaid
sequenceDiagram
    participant AD as Admin
    participant FE as Frontend
    participant BE as Backend

    AD->>FE: Navigate to /admin/system-config
    FE->>BE: GET /api/admin/config
    BE-->>FE: { aiModel, rateLimits, featureFlags, ... }
    FE->>FE: Render config form

    AD->>FE: Update a field → Submit
    FE->>BE: POST /api/admin/config { key: "aiModel", value: "claude-opus-4-6" }
    BE-->>FE: { success: true }
    FE->>FE: Show "Config saved" toast
```

---

## 10. Developer Tools

**Entry:** `/admin/developer`

Admin-only developer tooling. Protected by `authType="admin"` guard. Contains API key management, debug information, and internal tooling for the engineering team.
