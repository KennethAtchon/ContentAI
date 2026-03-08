---
description: Setup new feature with proper structure following project conventions
---

# New Feature Setup Workflow

This workflow helps you create a new feature following the project's established patterns and conventions.

## Steps

### 1. Create Feature Directory Structure
```bash
# Create the main feature directory
mkdir -p frontend/src/features/[feature-name]/{components,hooks,services,types}
mkdir -p backend/src/features/[feature-name]/{services,types,routes}
```

### 2. Frontend Setup
- Create `index.ts` barrel export in `frontend/src/features/[feature-name]/`
- Add components with proper TypeScript interfaces
- Create custom hooks for state management
- Set up service classes for API calls
- Define TypeScript types in dedicated files

### 3. Backend Setup
- Create API routes following RESTful conventions
- Add service classes for business logic
- Define database schema types
- Add middleware for authentication/authorization if needed

### 4. Route Integration
- Add TanStack Router routes in `frontend/src/routes/`
- Follow route group conventions: `(public)`, `(auth)`, `(customer)`, `admin/`
- Update route types and navigation

### 5. Translation Setup
- Add translation keys to `frontend/src/translations/en.json`
- Follow existing key naming conventions
- Use translations in all components (no hardcoded strings)

### 6. Testing Setup
- Create unit tests for components and services
- Add integration tests for API routes
- Set up test mocks following existing patterns

### 7. Documentation Updates
- Update relevant documentation in `docs/AI_Orchestrator/`
- Add API documentation if applicable
- Update feature overview

## Code Patterns to Follow

### Component Pattern
```typescript
// frontend/src/features/[feature]/components/[component].tsx
'use client'

import { useTranslation } from "react-i18next"
import { Button } from "@/shared/components/ui/button"

export function FeatureComponent() {
  const { t } = useTranslation()
  // Component logic
}
```

### Service Pattern
```typescript
// frontend/src/features/[feature]/services/[feature]-service.ts
export class FeatureService {
  static async operation(input: Input): Promise<Output> {
    // Business logic
  }
}
```

### API Route Pattern
```typescript
// backend/src/features/[feature]/routes/[route].ts
export async function POST(c: Context) {
  // Auth check
  // Validation
  // Business logic
  // Return response
}
```

## Environment Variables
- Add new env vars to `envUtil.ts` files (both frontend and backend)
- Update `.env.example` files
- Use proper prefixes (`VITE_` for frontend)

## Quality Checks
- Run `bun lint` in both frontend and backend
- Run `bun test` to ensure tests pass
- Check TypeScript compilation
- Verify translations are complete

// turbo: After creating directories, run the setup commands automatically