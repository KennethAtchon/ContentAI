---
description: Deploy application to production with comprehensive checks
---

# Deployment Workflow

This workflow ensures safe and reliable deployment of your application.

## Pre-Deployment Checks

### 1. Run All Tests
```bash
# Frontend tests
cd frontend && bun test

# Backend tests  
cd backend && bun test

# E2E tests
cd e2e && bun test
```

### 2. Code Quality Checks
```bash
# Frontend linting and formatting
cd frontend && bun lint && bun format

# Backend linting
cd backend && bun lint
```

### 3. Build Verification
```bash
# Frontend production build
cd frontend && bun build

# Verify build output exists
ls -la frontend/dist/
```

### 4. Environment Verification
- Check all required environment variables are set
- Verify `.env.example` is up to date
- Validate Firebase configuration
- Check database connection strings

### 5. Database Migration Check
```bash
# Generate and apply any pending migrations
cd backend && bun db:generate && bun db:migrate
```

## Deployment Steps

### 1. Update Version
- Update `package.json` versions if needed
- Update changelog in `CHANGELOG.md`
- Tag release in git

### 2. Frontend Deployment
- Build production assets
- Deploy to hosting service (Vercel, Netlify, etc.)
- Verify deployment is live

### 3. Backend Deployment
- Deploy API server
- Run health checks
- Verify database connectivity

### 4. Post-Deployment Verification
- Test critical user flows
- Check monitoring dashboards
- Verify error tracking is working
- Test authentication flows

## Rollback Procedures

### Quick Rollback
- Revert to previous git tag
- Redeploy previous version
- Verify functionality restored

### Database Rollback
- Have recent database backups ready
- Document rollback procedures
- Test rollback process regularly

## Monitoring After Deployment

### Health Checks
- Monitor application uptime
- Check API response times
- Watch error rates
- Monitor database performance

### User Metrics
- Track key user interactions
- Monitor conversion rates
- Check for unusual error patterns
- Verify authentication success rates

## Troubleshooting Common Issues

### Build Failures
- Check TypeScript compilation errors
- Verify all dependencies are installed
- Check environment variable configuration
- Review recent changes for breaking issues

### Runtime Errors
- Check application logs
- Verify database connectivity
- Check external API integrations
- Review recent deployments

### Performance Issues
- Monitor database query performance
- Check for memory leaks
- Review CDN performance
- Analyze bundle sizes

// turbo: Run tests and quality checks automatically