/**
 * Shared env loader for automation scripts.
 * Reads from backend/.env so you don't need a separate .env file here.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

export function loadEnv(): void {
  const envPath = resolve(import.meta.dir, "../../backend/.env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes (single or double)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Don't override vars already set in the environment
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    console.log(`Loaded env from ${envPath}\n`);
  } catch {
    console.warn(
      `Warning: Could not read ${envPath} — falling back to existing env vars\n`,
    );
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Make sure it is set in backend/.env or exported in your shell.`,
    );
  }
  return value;
}

/** Prompt the user for confirmation, or skip if --confirm flag is passed. */
export async function promptConfirm(message: string): Promise<boolean> {
  if (process.argv.includes("--confirm")) return true;

  process.stdout.write(`\n${message}\nType "yes" to continue: `);

  return new Promise((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (data: string) => {
      process.stdin.pause();
      resolve(data.toString().trim().toLowerCase() === "yes");
    });
  });
}

export const DRY_RUN = process.argv.includes("--dry-run");
