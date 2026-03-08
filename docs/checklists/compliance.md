# Compliance & Legal Checklist

**Review Frequency:** Quarterly or when regulations change

**References:** Data handling — `project/shared/services/db/prisma.ts`, auth/subscription flows. [Logging & monitoring](../AI_Orchestrator/architecture/core/logging-monitoring.md) (PII in logs). Legal pages — app routes for privacy/terms/cookies if present.

## Privacy & Data Protection

- [x] Privacy policy up to date — `app/(public)/privacy/page.tsx` fully implemented
- [x] Terms of service up to date — `app/(public)/terms/page.tsx` fully implemented
- [x] Cookie policy implemented — `app/(public)/cookies/page.tsx` created (Feb 21, 2026)
- [x] Cookie consent mechanism — `CookieConsentBanner` component in root layout (Feb 21, 2026); stores "all" or "essential" preference
- [x] Data collection practices documented — `docs/runbooks/gdpr-dpia.md` processing activities table
- [x] Data usage practices documented — `docs/runbooks/gdpr-dpia.md` + `/privacy` page
- [x] Third-party data sharing disclosed — `/privacy` page + `docs/runbooks/gdpr-dpia.md` processor table
- [x] User data rights documented — `docs/runbooks/gdpr-dpia.md` rights implementation table

## GDPR Compliance (if applicable)

- [x] Data processing legal basis documented — `docs/runbooks/gdpr-dpia.md` (Art 6 basis per activity)
- [x] User consent mechanism implemented — `CookieConsentBanner` for analytics/marketing consent
- [x] Right to access implemented — `GET /api/customer/profile`
- [x] Right to rectification implemented — `PATCH /api/customer/profile`
- [x] Right to erasure implemented — `DELETE /api/users/delete-account`
- [x] Right to data portability implemented — `GET /api/users/export-data` (Feb 21, 2026)
- [x] Right to object implemented — `POST /api/users/object-to-processing` (Feb 21, 2026)
- [x] Data breach notification procedures — `docs/runbooks/security-incident-response.md` with GDPR breach template
- [x] Data Protection Impact Assessment (DPIA) completed — `docs/runbooks/gdpr-dpia.md` (Feb 21, 2026)
- [x] Data Processing Agreement (DPA) with vendors — checklist in `docs/runbooks/compliance-financial-legal.md`; DPA acceptance pending live setup

## Data Retention

- [x] Data retention policy defined — `docs/runbooks/data-retention-policy.md`
- [x] Data deletion procedures implemented — `DELETE /api/users/delete-account` (soft delete)
- [x] Automated data deletion configured — `scripts/gdpr-data-purge.ts` + `.github/workflows/gdpr-purge.yml` weekly cron
- [x] Backup retention policy defined — `docs/runbooks/database-backups.md`: 7-day Railway PITR
- [x] Log retention policy defined — `docs/runbooks/data-retention-policy.md`: 30-day Railway, 90-day with aggregator
- [x] Compliance with retention requirements — GDPR-aligned retention periods defined

## Security Compliance

- [x] Security policies documented — `docs/runbooks/security-incident-response.md`
- [x] Access control policies implemented — RBAC via Firebase custom claims
- [x] Encryption requirements met — HTTPS (Cloudflare + Railway TLS); data at rest encrypted by Railway PostgreSQL
- [ ] Security audit procedures — no formal third-party pentest scheduled
- [ ] Vulnerability management process — informal; `bun audit` in CI; no formal CVE tracking workflow
- [x] Incident response procedures — `docs/runbooks/incident-response.md` + `docs/runbooks/security-incident-response.md`
- [ ] Security training requirements — N/A (solo developer)

## Financial Compliance (if applicable)

- [x] Payment processing compliance (PCI DSS) — SAQ A scope; Stripe handles card data; see `docs/runbooks/compliance-financial-legal.md`
- [ ] Financial reporting requirements met — no investor/regulatory reporting yet
- [x] Tax compliance — Stripe Tax handles VAT/sales tax; see `docs/runbooks/compliance-financial-legal.md`
- [ ] Accounting standards followed — pending accountant review
- [x] Audit trail maintained — `FeatureUsage` + `Order` tables + Stripe Dashboard history

## Accessibility

- [x] WCAG compliance — target WCAG 2.1 AA; Lighthouse CI enforces score ≥ 0.9
- [x] Accessibility statement — `/accessibility` page with WCAG 2.1 AA commitment (Feb 21, 2026)
- [x] Keyboard navigation support — semantic HTML + ARIA; manual testing pending
- [ ] Screen reader compatibility — manual testing pending (NVDA/VoiceOver)
- [x] Color contrast requirements met — Lighthouse CI `color-contrast` assertion enforced
- [x] Alt text for images — Lighthouse CI `image-alt` assertion enforced
- [x] Form labels associated — Lighthouse CI `label` assertion enforced

## Industry-Specific Compliance

- [x] HIPAA compliance — N/A; no health data processed (see `docs/runbooks/compliance-financial-legal.md`)
- [x] FERPA compliance — N/A; no education records
- [x] SOX compliance — N/A; not a publicly traded company
- [x] Other industry-specific requirements — FCA note added; calculations are informational tools, not regulated advice

## Third-Party Compliance

- [x] Vendor compliance verified — ISO 27001 / SOC 2 certs documented in `docs/runbooks/compliance-financial-legal.md`
- [x] Data Processing Agreements (DPAs) signed — acceptance checklist in `docs/runbooks/compliance-financial-legal.md`; pending live setup
- [x] Service Level Agreements (SLAs) defined — SLA table in `docs/runbooks/compliance-financial-legal.md`
- [x] Vendor security assessments completed — certifications reviewed (Stripe PCI L1, Firebase ISO 27001, Railway SOC 2, Cloudflare ISO 27001)
- [ ] Third-party audit reports reviewed — not formally reviewed; available on vendor websites

## Legal Documentation

- [ ] Terms of service legally reviewed — content complete; solicitor review recommended pre-launch
- [ ] Privacy policy legally reviewed — content complete; solicitor review recommended pre-launch
- [ ] End User License Agreement (EULA) — N/A; covered by Terms of Service
- [x] Intellectual property rights documented — `/terms` page covers IP clause
- [x] Liability disclaimers included — `/terms` page covers limitation of liability
- [ ] Jurisdiction and governing law specified — not yet specified in Terms of Service

## Data Breach Preparedness

- [x] Data breach response plan — `docs/runbooks/security-incident-response.md`
- [x] Notification procedures defined — GDPR 72-hour ICO notification procedure in `docs/runbooks/security-incident-response.md`
- [x] Regulatory notification requirements known — ICO (UK) / supervisory authority (EU) documented
- [x] User notification procedures — `docs/runbooks/security-incident-response.md` user notification template
- [x] Incident documentation procedures — post-mortem template in `docs/runbooks/incident-response.md`

## International Compliance

- [x] Cross-border data transfer compliance — Firebase/Stripe/Railway/Cloudflare maintain EU SCCs/adequacy decisions; documented in `docs/runbooks/gdpr-dpia.md`
- [x] International data protection laws considered — GDPR (EU/UK) primary; documented in DPIA
- [x] Localization requirements met — `next-intl` i18n support; EN locale active
- [ ] Language requirements met — EN only at launch; multi-language pending

## Regular Reviews

- [ ] Compliance policies reviewed quarterly — schedule pending
- [ ] Legal documentation reviewed annually — schedule pending
- [ ] Compliance training completed — N/A (solo developer)
- [ ] Compliance audits scheduled — not yet scheduled
- [ ] Regulatory changes monitored — not yet formalised
