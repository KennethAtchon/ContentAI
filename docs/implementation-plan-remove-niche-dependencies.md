# Database Schema Migration Plan: Remove Niche Dependencies

## Overview
Remove all niche-related functionality from the application, including the `userNiches` join table and niche references from projects. Projects will no longer be tied to niches.

## Current Dependencies Analysis

### Database Schema Changes Required
1. **Remove `userNiches` table** (`user_niche`)
2. **Remove `nicheId` column** from `projects` table
3. **Remove niche references** from relations and types
4. **Keep `niches` table** for now (reels still reference it)

### Backend Files Requiring Updates
- `/backend/src/infrastructure/database/drizzle/schema.ts` - Main schema file
- `/backend/src/routes/projects/index.ts` - Project routes using nicheId
- `/backend/src/routes/chat/index.ts` - Chat functionality with niche references
- `/backend/src/routes/admin/niches.ts` - Admin niche management
- `/backend/src/services/scraping.service.ts` - 14 niche references
- `/backend/src/services/queue.service.ts` - 11 niche references
- `/backend/src/services/reels/content-generator.ts` - 2 niche references
- `/backend/src/services/reels/reel-analyzer.ts` - 1 niche reference

### Frontend Files Requiring Updates
- `/frontend/src/features/admin/hooks/use-niches.ts` - 24 niche references
- `/frontend/src/routes/admin/_layout/niches.$nicheId.tsx` - 16 niche references
- `/frontend/src/features/chat/components/CreateProjectModal.tsx` - 8 niche references
- `/frontend/src/features/admin/components/NicheScrapingControls.tsx` - 6 niche references
- `/frontend/src/features/chat/components/ProjectSidebar.tsx` - 6 niche references
- `/frontend/src/routes/studio/discover.tsx` - 6 niche references
- `/frontend/src/shared/lib/query-keys.ts` - 4 niche references
- `/frontend/src/features/chat/types/chat.types.ts` - 3 niche references
- `/frontend/src/routes/admin/_layout/niches.index.tsx` - 2 niche references
- `/frontend/src/translations/en.json` - 1 niche reference

## Implementation Steps

### Phase 1: Database Schema Migration ✅ COMPLETED
1. **Updated schema.ts** - Removed userNiches table and nicheId from projects
2. **Generated migration** - Created migration file automatically
3. **Applied migration** - Database schema updated successfully
4. **Reset database** - Fresh schema applied with all changes

### Phase 2: Backend API Updates ✅ COMPLETED
1. **Update project routes** (`/backend/src/routes/projects/index.ts`):
   - ✅ Removed nicheId from project creation/update
   - ✅ Removed niche filtering logic
   - ✅ Updated validation schemas

2. **Update chat routes** (`/backend/src/routes/chat/index.ts`):
   - ✅ Removed niche-related logic from chat sessions

3. **Update admin routes** (`/backend/src/routes/admin/niches.ts`):
   - ✅ No user-niche endpoints found (only reel niche management)

4. **Update services**:
   - ✅ No userNiches references found in services
   - ✅ Kept legitimate niche references for reels functionality

### Phase 3: Frontend Updates ✅ COMPLETED
1. **Update project-related components**:
   - ✅ Removed niche selection from CreateProjectModal
   - ✅ Updated ProjectSidebar to not show niche info
   - ✅ Removed niche filtering from project lists

2. **Update admin components**:
   - ✅ No user-niche management found in admin interface (only reel scraping)

3. **Update types and queries**:
   - ✅ Removed nicheId from project types (chat.types.ts)
   - ✅ Updated query keys and hooks (no changes needed)
   - ✅ Removed niche-related translations (studio_chat_nicheId)

### Phase 4: Testing & Cleanup ✅ COMPLETED
1. **Database migration testing** ✅ - Migration applied successfully
2. **API endpoint testing** ✅ - Backend APIs updated and working
3. **Frontend component testing** ✅ - Components updated without errors
4. **Remove any remaining niche references** ✅ - Only legitimate reel niches remain
5. **Update documentation** ✅ - All documentation updated

## 🎉 **IMPLEMENTATION COMPLETE**

### Summary of Changes:
- **Database**: Removed `userNiches` table and `nicheId` from projects
- **Backend**: Updated all APIs to remove user-niche relationships  
- **Frontend**: Removed niche selection from project creation and display
- **Documentation**: Updated all relevant markdown files

### What Was Preserved:
- **Niches table**: Kept for reels discovery and admin functionality
- **Reel-niche relationships**: Maintained for content categorization
- **Admin niche management**: Preserved for scraping controls

### Current State:
- Projects are now standalone entities owned by users
- No more user-niche preferences or relationships
- Cleaner, simpler data model
- All functionality preserved except user-niche management

## Migration Status ✅ COMPLETED

The database schema has been successfully updated:
- ✅ `userNiches` table removed
- ✅ `nicheId` column removed from `projects` table  
- ✅ All relations updated
- ✅ Database reset with fresh schema applied

## Migration Results

**Before:** 14 tables with user-niche relationships
**After:** 13 tables with clean project-only structure

**Changes Applied:**
- Projects no longer reference niches
- Users no longer have niche preferences  
- Chat and project functionality simplified
- Reels still maintain niche relationships for discovery

## Risk Assessment
- **High Risk**: Breaking existing project-niche relationships
- **Medium Risk**: Frontend components may break without niche data
- **Low Risk**: Database migration is straightforward

## Rollback Plan
1. Keep database backup before migration
2. Revert schema.ts changes from git
3. Restore database from backup if needed

## Timeline Estimate
- **Phase 1**: 2-4 hours (Database + Schema)
- **Phase 2**: 4-6 hours (Backend API)
- **Phase 3**: 6-8 hours (Frontend)
- **Phase 4**: 2-3 hours (Testing)
- **Total**: 14-21 hours

## Notes
- Niches table will remain for reel functionality
- Consider if reels should also be decoupled from niches in future
- Some admin functionality may become redundant and can be removed
