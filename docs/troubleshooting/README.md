# Troubleshooting

Step-by-step fixes for common problems.

## Subscription issues

- **[stripe-role-missing.md](./stripe-role-missing.md)** — Subscription is active but `stripeRole` custom claim is missing from the Firebase token. Fix: add `firebaseRole` metadata to Stripe products.

- **[subscription-cancellation-during-trial.md](./subscription-cancellation-during-trial.md)** — Understanding how trial cancellations appear in the admin dashboard and Firestore.

- **[subscription-upgrade-downgrade-flow.md](./subscription-upgrade-downgrade-flow.md)** — How tier upgrades and downgrades flow through Stripe and Firebase.

## Frontend issues

- **[translation-system.md](./translation-system.md)** — i18n key not found, translations not loading, react-i18next setup issues.

---

When adding a new guide:
1. Create a `.md` file in this folder
2. Use the format: problem → root cause → step-by-step fix → verification
3. Add a link in this README

For architecture docs, see [../architecture/](../architecture/).
