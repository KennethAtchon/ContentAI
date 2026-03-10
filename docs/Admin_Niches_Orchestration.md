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

## 4. Frontend Admin Dashboard Updates

### A. Navigation
File: `frontend/src/features/admin/components/dashboard/dashboard-layout.tsx`
- Add a **"Niches & Scraping"** navigation item using an icon like `Database` or `Tags`.

### B. Niches Orchestration View
Files: 
- `frontend/src/routes/admin/_layout/niches.tsx` (Table View)
- `frontend/src/routes/admin/_layout/niches/$nicheId.tsx` (Detail View)

**High-Level Hub**:
A data table showing all Niches, their active status, and aggregate metrics (e.g., "150 Reels").

**Orchestration / Detail View**:
When clicking into a specific Niche, the Admin is taken to a powerful dashboard specific to that niche:
1. **Header Actions**: Prominent buttons to "Trigger Scrape", "Run Dedupe Routine", or "Edit Settings".
2. **Reels Management Tab**: A robust data table of all reels in this niche. Admins can view view count, engagement rate, etc., and can select multiple rows to delete them if they don't fit the platform's quality bar.
3. **Scrape History/Logs Tab**: (Optional future feature) Showing a history of when scrapes were triggered and their status.

### C. Data Access (Hooks)
File: `frontend/src/features/admin/hooks/use-niches.ts`
- Implement robust TanStack Query hooks covering:
  - `useNiches`
  - `useCreateNiche`, `useUpdateNiche`, `useDeleteNiche`
  - `useNicheReels`
  - `useScanNiche`, `useDedupeNiche`
  - `useDeleteAdminReel`

---

## 5. Frontend Discover Clean-Up

File: `frontend/src/routes/studio/discover.tsx`
- **Action**: Remove the `SearchCanvas` component completely. 
- **Action**: Remove any associated state (`inputNiche`, `handleScan`).
- **Result**: If the `niche` state has no corresponding reels available yet in the DB, gracefully show an `EmptyCanvas` Component that simply states "No reels found for this category". Users no longer prompt the scraper directly.
