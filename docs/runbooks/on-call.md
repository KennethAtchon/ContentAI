# On-Call Procedures

**Status:** Rotation schedule to be filled in by team; procedures are defined here.

---

## On-Call Responsibilities

The on-call engineer is the first responder for any production incident during their rotation.

**Responsibilities:**
- Acknowledge alerts within **5 minutes** (Critical) / **30 minutes** (Warning)
- Triage and resolve or escalate within the response SLAs below
- Update the incident Slack thread with progress every 15 minutes
- Complete a post-mortem for all P1/P2 incidents within 48 hours
- Hand off open incidents to the next on-call engineer at rotation boundary

---

## Rotation Schedule

| Week | Primary On-Call | Secondary (escalation) |
|------|----------------|------------------------|
| _(fill in)_ | _(name)_ | _(name)_ |

> Update this table before each rotation. Use PagerDuty, Opsgenie, or a shared calendar.

---

## Alert Response SLAs

| Severity | Acknowledge | First response | Resolution target |
|----------|-------------|----------------|-------------------|
| **P1 — Critical** | 5 min | 15 min | 1 hour |
| **P2 — High** | 15 min | 30 min | 4 hours |
| **P3 — Medium** | 30 min | 2 hours | Next business day |
| **P4 — Low** | Next business day | — | Next sprint |

---

## Escalation Path

```
Alert fires
    ↓
Primary on-call (acknowledges within 5 min for Critical)
    ↓ (if no acknowledgement or not resolved within SLA)
Secondary on-call
    ↓ (if still unresolved)
Engineering Manager
    ↓ (if P1, > 30 min unresolved)
CTO / Founder
```

---

## Contact List

| Role | Name | Email | Phone / Slack |
|------|------|-------|---------------|
| Primary on-call | _(fill in)_ | | |
| Secondary on-call | _(fill in)_ | | |
| Engineering Manager | _(fill in)_ | | |
| CTO | _(fill in)_ | | |
| Stripe support | — | support.stripe.com | — |
| Firebase support | — | firebase.google.com/support | — |
| Railway support | — | help.railway.app | — |

---

## Before Going On-Call Checklist

- [ ] Confirm access to Railway Dashboard
- [ ] Confirm access to Firebase Console
- [ ] Confirm access to Stripe Dashboard
- [ ] `#alerts` Slack channel notifications enabled on mobile
- [ ] Read the latest post-mortem(s) from previous rotation
- [ ] No planned personal travel that would prevent response

---

## Handoff Checklist

At the end of each rotation, the outgoing on-call engineer must:

- [ ] Close or hand off any open incidents
- [ ] Document any recurring or unusual alerts seen
- [ ] Update the rotation table above
- [ ] Brief the incoming on-call engineer on any ongoing issues

---

## Tools & Access

| Tool | URL | What it's for |
|------|-----|---------------|
| Railway Dashboard | railway.app | Deploy logs, health, env vars |
| Firebase Console | console.firebase.google.com | Auth, Firestore |
| Stripe Dashboard | dashboard.stripe.com | Payments, subscriptions |
| Uptime monitor | _(provider URL)_ | Uptime history |
| Log aggregator | _(provider URL)_ | Log search |
| Metrics dashboard | _(Grafana/Datadog URL)_ | System metrics |

---

## Common Quick Actions

```bash
# Check production health
curl https://your-app.com/api/health
curl https://your-app.com/api/ready

# Trigger manual rollback (see rollback.md for full procedure)
# In Railway Dashboard → Deployments → select previous deployment → Redeploy

# Check recent Railway logs
# Railway Dashboard → Project → Observability → Logs
```

---

## See Also

- `incident-response.md` — full incident response process
- `rollback.md` — how to roll back a deployment
- `alerting.md` — alert thresholds and routing
- `uptime-monitoring.md` — uptime check configuration
