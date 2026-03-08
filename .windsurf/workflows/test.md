---
description: Comprehensive testing workflow for all test types
---

# Testing Workflow

This workflow covers all testing aspects of your application to ensure code quality and reliability.

## Test Structure Overview

### Frontend Tests (`frontend/`)
- **Unit Tests**: Component testing with React Testing Library
- **Integration Tests**: API integration and user flows
- **E2E Tests**: Full application testing via Playwright

### Backend Tests (`backend/`)
- **Unit Tests**: Service and utility function testing
- **Integration Tests**: API endpoint testing with real database

## Running Tests

### Quick Test Run
```bash
# Frontend - all tests
cd frontend && bun test

# Backend - all tests
cd backend && bun test

# E2E tests
cd e2e && bun test
```

### Specific Test Types
```bash
# Frontend unit tests only
cd frontend && bun test:unit

# Frontend integration tests only
cd frontend && bun test:integ

# Backend unit tests only
cd backend && bun test:unit

# Watch mode for development
cd frontend && bun test:watch

# Coverage reports
cd frontend && bun test:coverage
```

### Single Test File
```bash
# Run specific test file
cd frontend && bun test __tests__/unit/utils/date.test.ts
```

## Test Writing Guidelines

### Frontend Component Tests
```typescript
import { render, screen } from '@testing-library/react'
import { FeatureComponent } from '@/features/feature/components/feature-component'

describe('FeatureComponent', () => {
  it('renders correctly', () => {
    render(<FeatureComponent />)
    expect(screen.getByText('expected text')).toBeInTheDocument()
  })
})
```

### Service Tests
```typescript
import { FeatureService } from '@/features/feature/services/feature-service'

describe('FeatureService', () => {
  it('performs operation correctly', async () => {
    const result = await FeatureService.operation(mockInput)
    expect(result).toEqual(expectedOutput)
  })
})
```

### API Endpoint Tests
```typescript
import { createTestApp } from '__tests__/helpers/create-test-app'

describe('Feature API', () => {
  it('returns correct response', async () => {
    const app = createTestApp()
    const res = await app.request('/api/feature', {
      method: 'POST',
      body: JSON.stringify(mockData)
    })
    expect(res.status).toBe(200)
  })
})
```

## Test Data Management

### Mock Data
- Use consistent mock data across tests
- Create fixtures in `__tests__/fixtures/`
- Use factory functions for dynamic test data

### Database Tests
- Use test database with clean state
- Run migrations before test suite
- Clean up data after each test

### Authentication Mocks
- Mock Firebase auth in test setup
- Use consistent user fixtures
- Test both authenticated and unauthenticated flows

## Coverage Requirements

### Target Coverage
- **Frontend**: 80%+ line coverage
- **Backend**: 85%+ line coverage
- **Critical paths**: 95%+ coverage

### Coverage Reports
```bash
# Generate coverage report
cd frontend && bun test:coverage

# View coverage in browser
open frontend/coverage/index.html
```

## Continuous Integration

### Pre-commit Checks
- Run relevant unit tests
- Check linting and formatting
- Verify TypeScript compilation

### Pre-merge Checks
- Run full test suite
- Check coverage thresholds
- Run E2E tests on critical paths

### Release Checks
- Full regression test suite
- Performance testing
- Security scanning

## Debugging Tests

### Common Issues
- **Test timeouts**: Check for async operations not properly awaited
- **Mock failures**: Verify mock setup in test files
- **Environment issues**: Check test environment variables

### Debugging Tools
```bash
# Run tests with debugger
cd frontend && bun --inspect-brk test

# Run specific test with verbose output
cd frontend && bun test --verbose specific-test.test.ts
```

## Performance Testing

### Load Testing
- Use `load-test.js` script in backend
- Test API endpoints under load
- Monitor database performance

### Frontend Performance
- Test bundle sizes
- Monitor render performance
- Check memory usage

## E2E Testing

### Setup
```bash
# Install Playwright browsers
cd e2e && npx playwright install

# Run E2E tests locally
cd e2e && bun test

# Run with UI for debugging
cd e2e && bun test --ui
```

### Test Scenarios
- Critical user journeys
- Authentication flows
- Form submissions
- Error handling

// turbo: Run tests automatically when called