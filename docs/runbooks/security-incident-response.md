# Security Incident Response Runbook

**Last updated:** Feb 21, 2026  
**Related:** [Incident Response](./incident-response.md)

---

## What Counts as a Security Incident

- Unauthorized access to admin routes or user data
- Suspected or confirmed data breach (PII, payment data, credentials exposed)
- Compromised API keys, secrets, or Firebase credentials
- Unusual authentication patterns (mass sign-in attempts, account takeover attempts)
- Malicious content submitted through public forms that bypassed validation
- Dependency with a critical CVE found in production

---

## Immediate Response (First 15 Minutes)

### 1. Contain

Do not try to preserve the attack in progress — contain it first.

**If credentials/secrets are compromised:**

```bash
# Rotate Firebase service account key
# Firebase Console → Project Settings → Service accounts → Generate new private key
# Update FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL in your deployment env

# Rotate CSRF secret
openssl rand -hex 32   # paste the output as CSRF_SECRET

# Rotate encryption key (WARNING: this will invalidate any encrypted data)
openssl rand -base64 24 | head -c 32

# Revoke Stripe keys
# Stripe Dashboard → Developers → API keys → Roll key

# Revoke Resend API key
# Resend Dashboard → API keys → Delete → Create new
```

**If a user account is compromised:**

```bash
# Disable the user in Firebase (prevents all new sign-ins with that account)
# Firebase Console → Authentication → Users → find user → Disable account
# Or via Admin SDK:
# adminAuth.updateUser(uid, { disabled: true })
```

**If a Firebase token may be stolen (force revoke all sessions for a user):**

```bash
# Via Firebase Admin SDK (run as a one-off script)
# adminAuth.revokeRefreshTokens(uid)
# This forces re-authentication — the next API call with the old token returns 401
```

**If the entire application is under attack (e.g. DDoS, mass data exfiltration):**

1. Enable Railway maintenance mode (or take down the deployment).
2. Block the attacker's IP at the network/CDN level.
3. Temporarily restrict the affected endpoints.

### 2. Assess

- What data may have been accessed or exfiltrated?
- How long has the incident been active?
- What is the attack vector?

Check logs for indicators:
```bash
# Railway logs — look for:
# - Unusual auth patterns (many 401s from same IP)
# - Admin route access from unexpected users
# - Large data exports
# - Unusual POST bodies
```

### 3. Notify

**Internal notification:**
- Immediately inform the team lead / CTO.
- Do not post details in public channels.

**External notification (if user data was breached):**

Under GDPR, data breaches must be reported to the relevant supervisory authority within **72 hours** of discovery.

User notification is required if the breach is likely to result in high risk to their rights and freedoms. Draft a notification email covering:
- What happened
- What data was affected
- What we are doing about it
- What users should do (e.g. change password)

See [GDPR Breach Notification Template](#gdpr-breach-notification-template) below.

---

## Investigation Steps

### Check application logs

```bash
# Railway → Logs → filter by:
# - 401/403 bursts (auth attacks)
# - Unusual IPs accessing admin routes
# - Large response sizes (data exfiltration)
```

### Check Firebase Authentication logs

Firebase Console → Authentication → Events (or Cloud Logging if enabled):
- Sign-in attempts from unusual locations
- Unusual account creation volume
- Password reset flood

### Check database for anomalous queries

```bash
# If slow query log is enabled:
# SELECT * FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC;

# Check for unexpected data access patterns in application logs
```

### Identify the affected scope

- Which users are affected?
- What data was accessed? (PII: name, email, phone, address?)
- Was payment data involved? (Stripe handles card data — Stripe is PCI compliant)
- Was Firebase auth data involved? (Firebase manages passwords — we don't store them)

---

## Remediation

1. **Patch the vulnerability** — identify and fix the code or configuration that allowed the incident.
2. **Deploy the fix** — follow the [deployment runbook](./deployment.md).
3. **Force re-authentication** — if credentials are suspected compromised, revoke refresh tokens for affected users.
4. **Audit all access** — review who accessed what during the incident window.
5. **Reset affected credentials** — rotate any secrets that may have been exposed.

---

## Post-Incident

1. Write an incident report (see [Incident Response](./incident-response.md) post-mortem template).
2. If GDPR breach notification was required, document:
   - Date and time notified to supervisory authority
   - Date and time notified to affected users
   - Reference number from supervisory authority response
3. Review and update `docs/checklists/security.md`.
4. Add new security tests for the vulnerability class.

---

## Security Contact

> **TODO:** Define the security contact before launch.

- **Internal:** [name/channel for security escalation]
- **Responsible disclosure:** [email for external security researchers to report vulnerabilities]

---

## GDPR Breach Notification Template

```
Subject: Important Security Notice — [Company Name] Data Breach

Dear [User Name / "Valued Customer"],

We are writing to inform you of a security incident that may have affected your account on [Product Name].

**What happened:**
[Brief, factual description of the incident.]

**When it happened:**
[Date range of the incident.]

**What information was involved:**
[List the types of data: email address, name, etc. Be specific.]

**What we are doing:**
- [Action 1: e.g. We have secured the vulnerability]
- [Action 2: e.g. We have revoked all active sessions]
- [Action 3: e.g. We have notified the relevant data protection authority]

**What you should do:**
- [e.g. Change your password on any service where you use the same password]
- [e.g. Be alert for phishing emails]

We sincerely apologize for this incident and take the security of your data very seriously.

If you have any questions, please contact us at [security@yourdomain.com].

[Company Name] Security Team
```
