# GDPR Data Protection Impact Assessment (DPIA)

**Completed:** Feb 21, 2026  
**Next review:** Feb 21, 2027  
**Controller:** YourApp (operator of your-app.com)

---

## 1. Necessity Assessment

| Question | Answer |
|----------|--------|
| Is this processing likely to result in high risk to individuals? | Low — financial calculations; no special category data |
| Does the processing involve systematic profiling? | No |
| Does the processing involve vulnerable groups (children)? | No — service is for adults (18+) |
| Is the processing on a large scale? | Low scale at launch; re-evaluate at 10,000+ users |
| **DPIA required?** | **Not mandatory under current scope; documented proactively** |

---

## 2. Processing Activities

| Activity | Data | Legal Basis | Retention |
|----------|------|-------------|-----------|
| User registration | Name, email, password (Firebase) | Contract performance (Art 6(1)(b)) | Until account deletion + 30 days |
| Calculator usage | Input values, calculation results | Contract performance (Art 6(1)(b)) | 12 months rolling |
| Subscription billing | Email, payment method (tokenised by Stripe) | Contract performance (Art 6(1)(b)) | 7 years (financial record-keeping) |
| Support messages | Name, email, message content | Legitimate interest (Art 6(1)(f)) | 2 years |
| Analytics | Anonymised usage metrics | Legitimate interest (Art 6(1)(f)) | 13 months |
| Audit logs | IP address, timestamps | Legal obligation (Art 6(1)(c)) | 90 days |

---

## 3. Data Flows

```
User browser
    ↓ HTTPS (TLS 1.3 via Cloudflare)
YourApp app (Railway, EU-West region)
    ↓
PostgreSQL (Railway) — profile, orders, usage history
    ↓
Firebase (Google) — authentication, Firestore subscriptions
    ↓
Stripe — payment processing (PCI DSS Level 1 certified)
```

**No personal data leaves the EU** without adequate safeguards (Firebase/Stripe maintain EU SCCs/adequacy decisions).

---

## 4. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Unauthorised access to user data | Low | High | Firebase Auth + RBAC + `checkRevoked: true`; DB access via limited app user (post item-32) |
| Data breach via XSS | Low | High | CSP headers; input sanitisation; HttpOnly session evaluation documented |
| Excessive data retention | Low | Medium | Data retention policy in `data-retention-policy.md`; automated deletion planned (item 45) |
| Third-party processor breach (Firebase, Stripe) | Very low | High | Both processors are ISO 27001 / SOC 2 certified; DPAs in place with Google and Stripe |
| Insecure transmission | Very low | High | Cloudflare TLS termination; HSTS enforced |
| Right to erasure not honoured | Very low | High | `DELETE /api/users/delete-account` soft-deletes + Firebase UID removal; hard delete planned |

**Residual risk level: LOW** — no high-risk processing identified.

---

## 5. Data Subject Rights Implementation

| Right | Status | Implementation |
|-------|--------|---------------|
| Right of access (Art 15) | ✅ | `GET /api/customer/profile` returns all stored profile data |
| Right to rectification (Art 16) | ✅ | `PATCH /api/customer/profile` allows name/phone/address update |
| Right to erasure (Art 17) | ✅ | `DELETE /api/users/delete-account` soft-deletes user + Firebase deletion |
| Right to data portability (Art 20) | ✅ | `GET /api/users/export-data` returns full JSON data export |
| Right to object (Art 21) | ✅ | `POST /api/users/object-to-processing` records objection to marketing/analytics |
| Right to restrict processing (Art 18) | Partial | Contact `support@your-app.com`; manual process until automated |
| Right not to be subject to automated decisions (Art 22) | N/A | No solely-automated decisions with legal effect |

---

## 6. Third-Party Processors

| Processor | Purpose | DPA | Certification |
|-----------|---------|-----|---------------|
| Google Firebase | Authentication, Firestore | Google Cloud DPA (standard) | ISO 27001, SOC 2 Type II |
| Stripe | Payment processing | Stripe DPA (standard) | PCI DSS Level 1, ISO 27001 |
| Railway | Hosting & database | Railway DPA | SOC 2 Type II |
| Cloudflare | CDN, WAF, DNS | Cloudflare DPA | ISO 27001, SOC 2 |

**Action:** Formally sign / accept DPAs with all processors (Stripe, Firebase, Railway, Cloudflare) via their dashboards. Document acceptance dates in this table.

---

## 7. DPA Acceptance Log

| Processor | DPA Accepted | Accepted by | Date |
|-----------|-------------|-------------|------|
| Google Firebase | ☐ Pending | — | — |
| Stripe | ☐ Pending | — | — |
| Railway | ☐ Pending | — | — |
| Cloudflare | ☐ Pending | — | — |

---

## 8. Review Schedule

| Event | Action |
|-------|--------|
| Annual review | Update this DPIA; review all processing activities |
| New feature processing personal data | Assess whether a new DPIA section is required |
| Data breach | Update risk register; notify ICO within 72 hours (see `security-incident-response.md`) |
| > 10,000 users | Reassess whether DPIA is mandatory |

---

## See Also

- `data-retention-policy.md`
- `security-incident-response.md`
- `docs/runbooks/gdpr-automation.md`
