#!/usr/bin/env bun
/**
 * Validate root, backend, and frontend `.env` files after copy + edit.
 * Run from repo root: `bun backend/scripts/check-local-env.ts`
 * Or: `./scripts/check-env.sh`
 *
 * Does not print secret values — only key names and OK/warn/error status.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.join(import.meta.dir, "..", "..");

const ARGS = new Set(process.argv.slice(2));
const WANT_CONNECT = ARGS.has("--connect") || ARGS.has("-c");
if (ARGS.has("--help") || ARGS.has("-h")) {
  console.log(`Usage: bun backend/scripts/check-local-env.ts [--connect]

  Validates required keys, placeholder / format checks (CSRF = 64 hex chars, etc.).
  --connect  Also ping Postgres (DATABASE_URL) and Redis (REDIS_URL); needs reachable hosts.
`);
  process.exit(0);
}

type Severity = "error" | "warn";

interface Finding {
  severity: Severity;
  file: string;
  message: string;
}

const findings: Finding[] = [];

function add(severity: Severity, file: string, message: string): void {
  findings.push({ severity, file, message });
}

/** Minimal .env parser: KEY=VALUE, # comments, double-quoted values with \\n. */
function parseDotenv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^([A-Za-z_][A-Za-z0-9_]*)$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnv(relPath: string): Record<string, string> | null {
  const abs = path.join(REPO_ROOT, relPath);
  if (!existsSync(abs)) return null;
  try {
    return parseDotenv(readFileSync(abs, "utf8"));
  } catch {
    add("error", relPath, "Could not read file");
    return null;
  }
}

function isBlank(v: string | undefined): boolean {
  return v === undefined || v.trim() === "";
}

/** Obvious template / example leftovers */
function looksLikePlaceholder(key: string, value: string): boolean {
  const v = value.toLowerCase();
  const patterns = [
    /your_firebase/,
    /your_project/,
    /your_client_email/,
    /your_sender/,
    /your_stripe/,
    /your_anthropic/,
    /your_account/,
    /your_access/,
    /your_bucket/,
    /yourdomain\.com/,
    /\[from_email\]/i,
    /\[reply_to_email\]/i,
    /sk_test_your/,
    /sk-ant-your/,
    /whsec_your/,
    /re_your_resend/,
    /placeholder/,
  ];
  if (key.includes("FIREBASE_PRIVATE_KEY") || key === "FIREBASE_PRIVATE_KEY") {
    if (value.includes("Your_Private_Key_Here")) return true;
  }
  return patterns.some((p) => p.test(v));
}

const HEX64 = /^[0-9a-fA-F]{64}$/;

function checkBackend(env: Record<string, string>): void {
  const required = [
    "FIREBASE_API_KEY",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET",
    "FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_APP_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "CSRF_SECRET",
  ] as const;

  for (const k of required) {
    if (isBlank(env[k])) {
      add("error", "backend/.env", `Missing or empty: ${k}`);
      continue;
    }
    if (looksLikePlaceholder(k, env[k]!)) {
      add(
        "error",
        "backend/.env",
        `${k} still looks like a placeholder — replace with a real value`,
      );
    }
  }

  const pk = env.FIREBASE_PRIVATE_KEY ?? "";
  if (pk && !pk.includes("BEGIN PRIVATE KEY")) {
    add(
      "error",
      "backend/.env",
      "FIREBASE_PRIVATE_KEY should contain PEM (BEGIN PRIVATE KEY…)",
    );
  }

  const csrf = env.CSRF_SECRET ?? "";
  if (csrf && !HEX64.test(csrf)) {
    add(
      "error",
      "backend/.env",
      "CSRF_SECRET must be exactly 64 hex characters (32 bytes). Run: openssl rand -hex 32",
    );
  }

  const enc = env.ENCRYPTION_KEY?.trim() ?? "";
  if (enc && !HEX64.test(enc)) {
    add(
      "error",
      "backend/.env",
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes) when set",
    );
  }

  const db = env.DATABASE_URL?.trim() ?? "";
  if (db) {
    try {
      const u = new URL(db);
      if (!["postgres:", "postgresql:"].includes(u.protocol)) {
        add(
          "warn",
          "backend/.env",
          "DATABASE_URL should use postgres:// or postgresql://",
        );
      }
    } catch {
      add("error", "backend/.env", "DATABASE_URL is not a valid URL");
    }
  } else {
    add(
      "warn",
      "backend/.env",
      "DATABASE_URL empty — required when running the API (Compose usually injects this)",
    );
  }

  const redis = env.REDIS_URL?.trim() ?? "";
  if (redis) {
    try {
      const u = new URL(redis);
      if (u.protocol !== "redis:") {
        add("warn", "backend/.env", "REDIS_URL should use redis://");
      }
    } catch {
      add("error", "backend/.env", "REDIS_URL is not a valid URL");
    }
  } else {
    add(
      "warn",
      "backend/.env",
      "REDIS_URL empty — required when running the API (Compose usually injects this)",
    );
  }
}

function checkFrontend(env: Record<string, string>): void {
  const required = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
    "VITE_STRIPE_PUBLISHABLE_KEY",
  ] as const;

  for (const k of required) {
    if (isBlank(env[k])) {
      add("error", "frontend/.env", `Missing or empty: ${k}`);
      continue;
    }
    if (looksLikePlaceholder(k, env[k]!)) {
      add(
        "error",
        "frontend/.env",
        `${k} still looks like a placeholder — replace with a real value`,
      );
    }
  }

  const stripe = env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
  if (stripe && !stripe.startsWith("pk_")) {
    add(
      "warn",
      "frontend/.env",
      "VITE_STRIPE_PUBLISHABLE_KEY should start with pk_",
    );
  }

  const api = env.VITE_API_URL?.trim() ?? "";
  if (api) {
    try {
      new URL(api);
    } catch {
      add("error", "frontend/.env", "VITE_API_URL must be a valid URL");
    }
  }
}

function checkRoot(env: Record<string, string> | null, rel: string): void {
  if (!env) {
    add(
      "warn",
      rel,
      "File missing — OK for host-only dev; create it for docker compose (POSTGRES_*)",
    );
    return;
  }
  for (const k of [
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
  ] as const) {
    if (isBlank(env[k])) {
      add("warn", `${rel}`, `Empty ${k} — set for Docker Postgres`);
    }
  }
}

function crossCheck(
  backendEnv: Record<string, string>,
  frontendEnv: Record<string, string>,
): void {
  const b = backendEnv.FIREBASE_PROJECT_ID?.trim();
  const f = frontendEnv.VITE_FIREBASE_PROJECT_ID?.trim();
  if (b && f && b !== f) {
    add(
      "warn",
      "backend/.env ↔ frontend/.env",
      `FIREBASE_PROJECT_ID (${b}) !== VITE_FIREBASE_PROJECT_ID (${f})`,
    );
  }
}

async function tryConnect(backendEnv: Record<string, string>): Promise<void> {
  const dbUrl = backendEnv.DATABASE_URL?.trim();
  const redisUrl = backendEnv.REDIS_URL?.trim();
  if (!dbUrl) {
    add("warn", "--connect", "Skip Postgres: DATABASE_URL empty");
  } else {
    try {
      const postgres = (await import("postgres")).default;
      const sql = postgres(dbUrl, {
        max: 1,
        idle_timeout: 2,
        connect_timeout: 5,
      });
      await sql`select 1`;
      await sql.end({ timeout: 2 });
      console.log("  Postgres: OK (select 1)");
    } catch (e) {
      add(
        "warn",
        "--connect",
        `Postgres unreachable: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  if (!redisUrl) {
    add("warn", "--connect", "Skip Redis: REDIS_URL empty");
  } else {
    try {
      const { default: Redis } = await import("ioredis");
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5_000,
        lazyConnect: true,
      });
      await client.connect();
      const pong = await client.ping();
      client.disconnect(false);
      if (pong !== "PONG") {
        add("warn", "--connect", `Redis ping returned ${pong}`);
      } else {
        console.log("  Redis: OK (PING)");
      }
    } catch (e) {
      add(
        "warn",
        "--connect",
        `Redis unreachable: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

async function main(): Promise<void> {
  console.log("Checking local env files (values are not shown)…\n");

  const root = loadEnv(".env");
  const backend = loadEnv("backend/.env");
  const frontend = loadEnv("frontend/.env");

  checkRoot(root, ".env");
  if (backend) checkBackend(backend);
  else
    add(
      "error",
      "backend/.env",
      "File missing — copy from backend/.env.example",
    );

  if (frontend) checkFrontend(frontend);
  else
    add(
      "error",
      "frontend/.env",
      "File missing — copy from frontend/.env.example",
    );

  if (backend && frontend) crossCheck(backend, frontend);

  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  if (findings.length > 0) {
    console.log("Results:\n");
    for (const f of findings) {
      const tag = f.severity === "error" ? "ERROR" : "WARN ";
      console.log(`  [${tag}] ${f.file}: ${f.message}`);
    }
    console.log("");
  } else {
    console.log("  No issues reported.\n");
  }

  if (WANT_CONNECT && backend) {
    console.log("Connectivity (--connect)…");
    await tryConnect(backend);
    console.log("");
  } else if (WANT_CONNECT && !backend) {
    console.log("Connectivity (--connect): skipped (no backend/.env)\n");
  }

  if (errors.length > 0) {
    console.log(
      `Failed with ${errors.length} error(s${warns.length ? `, ${warns.length} warning(s)` : ""}).`,
    );
    process.exit(1);
  }
  if (warns.length > 0) {
    console.log(`OK with ${warns.length} warning(s) — fix before production.`);
    process.exit(0);
  }
  console.log("All checks passed.");
  process.exit(0);
}

await main();
