# Data Retention Policy

**Last updated:** Feb 21, 2026  
**Status:** Draft — pending legal/compliance review before production launch

---

## Application Logs

| Environment | Storage | Default Retention | Target Retention |
|-------------|---------|------------------|-----------------|
| Production (Railway) | Railway stdout/stderr capture | 7 days (free tier) / 30 days (paid) | **30 days** minimum |
| Production (if Loki/Datadog configured) | External log aggregator | Depends on plan | **90 days** |
| Development | Local stdout | Session only | N/A |

**Notes:**
- Application logs are emitted via `debugLog` and `systemLogger` to stdout/stderr.
- PII sanitization is applied to all logs in production (`pii-sanitization.ts`).
- No sensitive credentials, full credit card numbers, or Firebase private keys appear in logs.
- Auth failure events, rate limit violations, and admin actions are logged with structured metadata.

**Action items:**
- [ ] Configure log aggregation (Loki, Datadog, or similar) before production launch.
- [ ] Set a log retention policy in the chosen aggregation tool (recommended: 90 days for production).
- [ ] Document the log aggregation setup once configured.

---

## Metrics

| Data | Storage | Retention |
|------|---------|-----------|
| Prometheus metrics (`/api/metrics`) | In-memory only (lost on restart) | None — ephemeral |
| Custom business events | Emitted to logs | See Application Logs above |
| Firebase/Analytics events | Google Analytics / Firebase | Google's retention settings (default: 14 months) |

**Notes:**
- No time-series metrics database (e.g., InfluxDB, Prometheus remote write) is currently configured.
- Metrics scraped from `/api/metrics` are ephemeral — they reset on deployment.

**Action items:**
- [ ] Configure a Prometheus-compatible metrics store if long-term performance trends are needed.
- [ ] Set metrics retention to 13 months to align with GA4 default.
- [ ] Review Google Analytics retention settings in the Firebase console.

---

## Database Records

| Data Type | Table(s) | Retention | Deletion Mechanism |
|-----------|---------|-----------|-------------------|
| User accounts | `User` | Until right-to-erasure request | `DELETE /api/users/delete-account` anonymizes all PII |
| Orders | `Order` | Financial records: 7 years (legal minimum) | Do not auto-delete; anonymize user reference on account deletion |
| Calculator usage | `FeatureUsage` | 2 years | Anonymize on account deletion |
| Contact messages | `ContactMessage` | 1 year | Manual admin deletion or scheduled job |
| Sessions / auth tokens | Firebase (external) | Firebase manages | Firebase token TTL: 1 hour; refresh tokens: until revoked |

**Notes:**
- "Right to erasure" (`DELETE /api/users/delete-account`) anonymizes all PII by overwriting `name`, `email`, `phone`, `address` with placeholder values. The user record itself is soft-deleted (`isDeleted: true`).
- Order records must be retained for financial/tax compliance (typically 7 years in most jurisdictions). Do not hard-delete orders; instead, remove the `userId` foreign key or replace with an anonymized user ID.

**Action items:**
- [ ] Implement automated deletion of `ContactMessage` records older than 1 year.
- [ ] Verify that account deletion does not cascade-delete `Order` records.
- [ ] Document the data model relationships to confirm no unintended cascades.

---

## Backups

| Data | Backup Strategy | Retention | Recovery Time Objective (RTO) |
|------|----------------|-----------|-------------------------------|
| PostgreSQL (Railway) | Railway managed backups (paid plan) | 7 days | < 1 hour |
| Redis | Ephemeral (rate limit / session data) | Not backed up | Instant restart (data is transient) |
| Firebase Firestore | Firebase managed (Point-in-Time Recovery on Blaze plan) | 7 days PITR | < 1 hour |

**Notes:**
- Redis stores only ephemeral data (rate limit counters, CSRF tokens). Loss of Redis data is recoverable — users will simply need to re-request CSRF tokens and rate limit counters will reset.
- PostgreSQL contains the authoritative business data and must be backed up.

**Action items:**
- [ ] Enable Railway managed PostgreSQL backups (requires paid plan).
- [ ] Test a backup restore before production launch.
- [ ] Document the restore procedure in [rollback.md](./rollback.md).
- [ ] Enable Firebase Firestore PITR on the Blaze plan.

---

## Compliance Considerations

- **GDPR (if applicable):** Personal data must not be retained longer than necessary for its original purpose. Contact messages should be deleted after 1 year unless there is an ongoing support relationship.
- **PCI DSS:** Stripe handles all card data; we never store raw card numbers. Our scope is limited to ensuring we do not log card data (verified by `pii-sanitization.ts`).
- **Financial records:** Order records and payment history must be retained for 7 years in most jurisdictions.

---

## Review Schedule

This policy should be reviewed:
- Annually
- After any significant changes to data collection or storage
- After any data breach or security incident
- When regulations change (GDPR updates, new regional requirements)
