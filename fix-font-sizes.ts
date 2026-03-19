#!/usr/bin/env bun
/**
 * Auto-fixes arbitrary Tailwind font-size classes → standard scale.
 * e.g. text-[13px] → text-sm, text-[1rem] → text-base
 *
 * Inline styles and CSS font-size properties are skipped (logged for manual review).
 *
 * Usage:
 *   bun fix-font-sizes.ts --dry-run   # preview only
 *   bun fix-font-sizes.ts             # apply changes
 */

const DRY_RUN = Bun.argv.includes("--dry-run");
const ROOT = import.meta.dir + "/frontend/src";

// Map pixel value → nearest Tailwind class
const PX_TO_CLASS: [number, string][] = [
  [10, "text-xs"], [11, "text-xs"], [12, "text-xs"],
  [13, "text-sm"], [14, "text-sm"], [15, "text-sm"],
  [16, "text-base"],
  [18, "text-lg"],
  [20, "text-xl"],
  [24, "text-2xl"],
  [30, "text-3xl"],
  [36, "text-4xl"],
  [48, "text-5xl"],
  [60, "text-6xl"],
  [72, "text-7xl"],
  [96, "text-8xl"],
  [128, "text-9xl"],
];

function nearestClass(raw: string): string | null {
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  const px = raw.trimEnd().endsWith("rem") ? Math.round(n * 16) : Math.round(n);
  let best = PX_TO_CLASS[0];
  for (const entry of PX_TO_CLASS) {
    if (Math.abs(entry[0] - px) < Math.abs(best[0] - px)) best = entry;
  }
  return best[1];
}

// Matches text-[13px], text-[0.9rem], text-[1.1em] etc.
const ARBITRARY = /\btext-\[(\d+(?:\.\d+)?(?:px|rem|em))\]/g;

const glob = new Bun.Glob("**/*.{ts,tsx,css}");
let totalFiles = 0;
let totalReplacements = 0;
const skipped: string[] = [];

for await (const rel of glob.scan(ROOT)) {
  const path = ROOT + "/" + rel;
  const original = await Bun.file(path).text();

  // Track inline styles / CSS for manual review
  if (/fontSize\s*:|font-size\s*:/.test(original)) {
    skipped.push(rel);
  }

  let count = 0;
  const updated = original.replace(ARBITRARY, (match, val) => {
    const cls = nearestClass(val);
    if (!cls) return match;
    count++;
    return cls;
  });

  if (count > 0) {
    totalFiles++;
    totalReplacements += count;
    console.log(`${DRY_RUN ? "[dry-run] " : ""}${rel} — ${count} fix${count > 1 ? "es" : ""}`);
    if (!DRY_RUN) await Bun.write(path, updated);
  }
}

console.log(`\n${DRY_RUN ? "[dry-run] " : ""}Fixed: ${totalReplacements} arbitrary classes in ${totalFiles} files.`);

if (skipped.length > 0) {
  console.log(`\n⚠ Manual review needed (inline style / CSS font-size):`);
  for (const f of skipped) console.log(`  ${f}`);
}
