# Troubleshooting

Step-by-step fixes for common problems.

## Subscription issues

- **[stripe-role-missing.md](./stripe-role-missing.md)** — Subscription is active but `stripeRole` custom claim is missing from the Firebase token. Fix: add `firebaseRole` metadata to Stripe products.

- **[subscription-cancellation-during-trial.md](./subscription-cancellation-during-trial.md)** — Understanding how trial cancellations appear in the admin dashboard and Firestore.

- **[subscription-upgrade-downgrade-flow.md](./subscription-upgrade-downgrade-flow.md)** — How tier upgrades and downgrades flow through Stripe and Firebase.

## Frontend issues

- **[translation-system.md](./translation-system.md)** — i18n key not found, translations not loading, react-i18next setup issues.

## Docker / local dev

- **[docker-postgres-startup-packet.md](./docker-postgres-startup-packet.md)** — Postgres logs "invalid length of startup packet" when running Docker.

- **Local Docker broken after Railway config** — If you set `NODE_ENV=production` (e.g. for Railway) and local `docker compose up` then fails: compose no longer uses `NODE_ENV` for the build target. It uses `COMPOSE_BUILD_TARGET` (default `development`). Leave `COMPOSE_BUILD_TARGET` unset for local; Railway does not use docker-compose. See [Railway Frontend Deployment](../railway-frontend-deployment.md#local-docker-vs-railway).

---

When adding a new guide:
1. Create a `.md` file in this folder
2. Use the format: problem → root cause → step-by-step fix → verification
3. Add a link in this README

For architecture docs, see [../architecture/](../architecture/).
