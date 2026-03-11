# Admin Niches Orchestration & Discover Cleanup

## 1. Overview
The goal is to cleanly separate the **niche scanning** capability from the user-facing application and move it entirely into a high-powered **Admin Dashboard feature**. 

This prevents arbitrary users from directly triggering expensive scrape jobs, and instead provides admins with a catalog of platform-curated niches. The Admin "Niches & Scraping" tab will serve as a comprehensive orchestration view, allowing administrators to not only create/edit/delete niches, but also trigger scrape jobs, view existing scraped reels for each niche in a data table, organize them, and run deduplication logic.

---

## 2. Database Schema Changes

File: `backend/src/infrastructure/database/drizzle/schema.ts`

### New `niches` Table
We'll introduce a `niches` table to store curated categories globally:
```typescript
export const niches = pgTable("niche", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // e.g., "Personal Finance"
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

### Updates to `reels` Table
Currently, `reels` uses a plain-text `niche` column. To enable robust relation and management, we will add a `nicheId` foreign key linking to the `niches` table. We will clear the database completely, no need for backwards compatibility. When we make this change, `nicheId` will be required and set to General if not provided.

---

## 3. Backend Routing & APIs

### A. Delete User Scanning
File: `backend/src/routes/reels/index.ts`
- **Action**: Completely remove `POST /api/reels/scan`. Users should only be able to query existing curated reels via `GET /api/reels?niche=...`.

### B. Admin Orchestration Endpoints
File: `backend/src/routes/admin/index.ts` (or a dedicated `backend/src/routes/admin/niches.ts`)
- **`GET /api/admin/niches`**: List all niches, ideally returning an aggregated count of how many reels exist per niche.
- **`POST /api/admin/niches`**: Create a new niche.
- **`PUT /api/admin/niches/:id`**: Update niche details (name, active status).
- **`DELETE /api/admin/niches/:id`**: Delete a niche (with caution regarding orphaned reels).
- **`POST /api/admin/niches/:id/scan`**: Queue a scrape job for this niche (Trigger Scrape).
- **`GET /api/admin/niches/:id/reels`**: Return a paginated list of all reels tagged with this niche.
- **`POST /api/admin/niches/:id/dedupe`**: Trigger a background routine or immediate query to find and merge/delete duplicate reels (checking external IDs or video URLs).
- **`DELETE /api/admin/reels/:reelId`**: Allow admins to hard-delete irrelevant, poor-quality, or duplicate reels directly from the management table.

---

## 4. Frontend Admin Dashboard Design Specifications

### A. Layout Architecture

**Note**: All visual styling (colors, typography, etc.) will match the existing admin UI theme.

#### Navigation Integration
File: `frontend/src/features/admin/components/dashboard/dashboard-layout.tsx`
- Add **"Niches & Scraping"** navigation item using `Database` icon
- Position as primary navigation item (second after Dashboard)

#### Main Niches Hub View
File: `frontend/src/routes/admin/_layout/niches.tsx`

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Niches Orchestration                                    │
│ [Search] [Filter: Active] [+ Create Niche] [Bulk Actions]       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Data Table: Niches Overview                              │   │
│ │ ┌─────┬─────────────┬─────────┬─────────┬─────────────┐ │   │
│ │ │ ID  │ Name        │ Status  │ Reels   │ Actions     │ │   │
│ │ ├─────┼─────────────┼─────────┼─────────┼─────────────┤ │   │
│ │ │ 1   │ Finance     │ ● Active│ 1,247   │ [View][Edit]│ │   │
│ │ │ 2   │ Fitness     │ ● Active│ 892     │ [View][Edit]│ │   │
│ │ │ 3   │ Tech        │ ○ Inactive│ 0     │ [View][Edit]│ │   │
│ │ └─────┴─────────────┴─────────┴─────────┴─────────────┘ │   │
│ └─────────────────────────────────────────────────────────┘   │
│ Pagination: [◀] 1-50 of 127 [▶]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Visual Design Details**:
- **Header**: Matches existing admin header styling
- **Table**: Standard data table styling with hover states
- **Status Indicators**: Simple active/inactive status indicators
- **Action Buttons**: Standard admin button styling with hover effects
- **Search Bar**: Full-width search with standard focus states

#### Niche Detail View
File: `frontend/src/routes/admin/_layout/niches/$nicheId.tsx`

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Finance" Niche Management                              │
│ [← Back] [Trigger Scrape] [Run Dedupe] [Edit Niche] [Delete] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Tab Navigation: [Reels] [History] [Analytics]            │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Reels Management Table                                   │   │
│ │ ┌─────┬─────────────┬─────────┬─────────┬─────────────┐ │   │
│ │ │ Sel │ Title       │ Views   │ Engagem. │ Actions     │ │   │
│ │ ├─────┼─────────────┼─────────┼─────────┼─────────────┤ │   │
│ │ │ ☐   │ "5 Tips..." │ 12.4K   │ 4.2%    │ [View][Del] │ │   │
│ │ │ ☐   │ "Budget..." │ 8.1K    │ 3.8%    │ [View][Del] │ │   │
│ │ └─────┴─────────────┴─────────┴─────────┴─────────────┘ │   │
│ │ [☐ Select All] [Delete Selected] [Export]                 │   │
│ └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Interactive Elements**:
- **Action Buttons**: Standard admin buttons with hover effects
- **Tab Navigation**: Standard tab navigation with active state indicators
- **Selection Checkboxes**: Standard checkbox styling
- **Data Rows**: Expandable on click to show preview thumbnail and metadata

### B. Layout Components

#### Navigation Integration
File: `frontend/src/features/admin/components/dashboard/dashboard-layout.tsx`
- Add **"Niches & Scraping"** navigation item using `Database` icon
- Position as primary navigation item (second after Dashboard)

#### Main Niches Hub View
File: `frontend/src/routes/admin/_layout/niches.tsx`

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Niches Orchestration                                    │
│ [Search] [Filter: Active] [+ Create Niche] [Bulk Actions]       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Data Table: Niches Overview                              │   │
│ │ ┌─────┬─────────────┬─────────┬─────────┬─────────────┐ │   │
│ │ │ ID  │ Name        │ Status  │ Reels   │ Actions     │ │   │
│ │ ├─────┼─────────────┼─────────┼─────────┼─────────────┤ │   │
│ │ │ 1   │ Finance     │ ● Active│ 1,247   │ [View][Edit]│ │   │
│ │ │ 2   │ Fitness     │ ● Active│ 892     │ [View][Edit]│ │   │
│ │ │ 3   │ Tech        │ ○ Inactive│ 0     │ [View][Edit]│ │   │
│ │ └─────┴─────────────┴─────────┴─────────┴─────────────┘ │   │
│ └─────────────────────────────────────────────────────────┘   │
│ Pagination: [◀] 1-50 of 127 [▶]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Visual Design Details**:
- **Header**: Matches existing admin header styling
- **Table**: Standard data table styling with hover states
- **Status Indicators**: Simple active/inactive status indicators
- **Action Buttons**: Standard admin button styling with hover effects
- **Search Bar**: Full-width search with standard focus states

#### Niche Detail View
File: `frontend/src/routes/admin/_layout/niches/$nicheId.tsx`

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Finance" Niche Management                              │
│ [← Back] [Trigger Scrape] [Run Dedupe] [Edit Niche] [Delete] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Tab Navigation: [Reels] [History] [Analytics]            │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Reels Management Table                                   │   │
│ │ ┌─────┬─────────────┬─────────┬─────────┬─────────────┐ │   │
│ │ │ Sel │ Title       │ Views   │ Engagem. │ Actions     │ │   │
│ │ ├─────┼─────────────┼─────────┼─────────┼─────────────┤ │   │
│ │ │ ☐   │ "5 Tips..." │ 12.4K   │ 4.2%    │ [View][Del] │ │   │
│ │ │ ☐   │ "Budget..." │ 8.1K    │ 3.8%    │ [View][Del] │ │   │
│ │ └─────┴─────────────┴─────────┴─────────┴─────────────┘ │   │
│ │ [☐ Select All] [Delete Selected] [Export]                 │   │
│ └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Interactive Elements**:
- **Action Buttons**: Standard admin buttons with hover effects
- **Tab Navigation**: Standard tab navigation with active state indicators
- **Selection Checkboxes**: Standard checkbox styling
- **Data Rows**: Expandable on click to show preview thumbnail and metadata

### C. Responsive Considerations
- **Desktop (>1200px)**: Full data table with side panel for detailed reel preview
- **Tablet (768-1200px)**: Stack layout, collapsible filters
- **Mobile (<768px)**: Card-based layout with horizontal scroll for data tables

### D. Data Access (Hooks)
File: `frontend/src/features/admin/hooks/use-niches.ts`
- Implement robust TanStack Query hooks covering:
  - `useNiches`
  - `useCreateNiche`, `useUpdateNiche`, `useDeleteNiche`
  - `useNicheReels`
  - `useScanNiche`, `useDedupeNiche`
  - `useDeleteAdminReel`

---

## 5. Backend Scrape Implementation

### A. Scraping Technology Stack
**Primary Approach**: Headless Browser Automation
- **Tool**: Playwright (recommended) or Puppeteer
- **Browser**: Chromium headless instance
- **Language**: TypeScript/Node.js backend service

### B. Scraping Service Architecture
File: `backend/src/services/scraping.service.ts`

**Core Components**:
```typescript
class ScrapingService {
  private browser: Browser;
  private page: Page;

  async initializeBrowser(): Promise<void>
  async scrapeNiche(nicheId: number, query: string): Promise<ScrapedReel[]>
  async extractReelData(element: Element): Promise<ReelData>
  async saveReels(reels: ScrapedReel[]): Promise<void>
  async cleanup(): Promise<void>
}
```

**Scraping Pipeline**:
1. **Browser Initialization**: Launch headless browser with stealth settings
2. **Target Navigation**: Navigate to content platform (Instagram Reels, TikTok, etc.)
3. **Search Execution**: Search for niche-specific content
4. **Data Extraction**: Extract video URLs, metadata, engagement metrics
5. **Deduplication**: Check against existing reels using external IDs
6. **Storage**: Save to database with proper niche association
7. **Cleanup**: Close browser and release resources

### C. Queue Management & Job Processing
File: `backend/src/services/queue.service.ts`

**Implementation Options**:
- **Bull Queue**: Redis-based job queue for reliability
- **Simple In-Memory**: For basic implementation
- **Database-Backed**: Using PostgreSQL as job store

**Job Structure**:
```typescript
interface ScrapeJob {
  id: string;
  nicheId: number;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: ScrapeResult;
  error?: string;
}
```

### D. Error Handling & Retry Logic
- **Rate Limiting**: Respect platform rate limits
- **Retry Strategy**: Exponential backoff for failed requests
- **Circuit Breaker**: Stop scraping after consecutive failures
- **Logging**: Comprehensive error tracking and monitoring

### E. Anti-Detection Measures
- **User Agent Rotation**: Randomize browser fingerprints
- **Proxy Support**: Optional proxy integration
- **Request Throttling**: Natural human-like timing
- **Stealth Mode**: Playwright stealth plugin

---

## 6. Frontend Discover Clean-Up

File: `frontend/src/routes/studio/discover.tsx`
- **Action**: Remove the `SearchCanvas` component completely. 
- **Action**: Remove any associated state (`inputNiche`, `handleScan`).
- **Result**: If the `niche` state has no corresponding reels available yet in the DB, gracefully show an `EmptyCanvas` Component that simply states "No reels found for this category". Users no longer prompt the scraper directly.
