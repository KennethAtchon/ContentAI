#!/usr/bin/env bun
/**
 * Bumps every Tailwind text-size class up one step across all frontend source files.
 * e.g. text-xs → text-sm, text-sm → text-base, text-base → text-lg, etc.
 * text-9xl is left unchanged (already at the top).
 *
 * Usage:
 *   bun bump-font-sizes.ts --dry-run   # preview only
 *   bun bump-font-sizes.ts             # apply changes
 */

const DRY_RUN = Bun.argv.includes("--dry-run");
const ROOT = import.meta.dir + "/frontend/src";

const STEP_UP: Record<string, string> = {
  "text-xs":   "text-sm",
  "text-sm":   "text-base",
  "text-base": "text-lg",
  "text-lg":   "text-xl",
  "text-xl":   "text-2xl",
  "text-2xl":  "text-3xl",
  "text-3xl":  "text-4xl",
  "text-4xl":  "text-5xl",
  "text-5xl":  "text-6xl",
  "text-6xl":  "text-7xl",
  "text-7xl":  "text-8xl",
  "text-8xl":  "text-9xl",
};

// Single-pass — text-9xl intentionally excluded so it stays put
const PATTERN = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl)\b/g;

const glob = new Bun.Glob("**/*.{ts,tsx,css}");
let totalFiles = 0;
let totalReplacements = 0;

for await (const rel of glob.scan(ROOT)) {
  const path = ROOT + "/" + rel;
  const original = await Bun.file(path).text();
  let count = 0;

  const updated = original.replace(PATTERN, (match) => {
    count++;
    return STEP_UP[match]!;
  });

  if (count > 0) {
    totalFiles++;
    totalReplacements += count;
    console.log(`${DRY_RUN ? "[dry-run] " : ""}${rel} — ${count} replacement${count > 1 ? "s" : ""}`);
    if (!DRY_RUN) await Bun.write(path, updated);
  }
}

console.log(`\n${DRY_RUN ? "[dry-run] " : ""}Done: ${totalReplacements} replacements across ${totalFiles} files.`);
