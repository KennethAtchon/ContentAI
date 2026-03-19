#!/usr/bin/env bun
/**
 * Audits the frontend for font-size inconsistencies:
 *   1. Arbitrary text sizes:  text-[13px], text-[0.8rem], etc.
 *   2. Inline style font-size: style={{ fontSize: "13px" }} / fontSize: 14
 *   3. Raw CSS font-size in .css files
 *
 * Usage: bun audit-font-sizes.ts
 */

import { readdir, readFile } from "fs/promises";
import { join, extname, relative } from "path";

const ROOT = join(import.meta.dir, "frontend/src");
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

// Tailwind scale for suggestions (px → class)
const PX_TO_CLASS: Record<number, string> = {
  10: "text-xs",    // close enough (xs=12px, bump down only if intentional)
  11: "text-xs",
  12: "text-xs",
  13: "text-sm",
  14: "text-sm",
  15: "text-sm",
  16: "text-base",
  18: "text-lg",
  20: "text-xl",
  24: "text-2xl",
  30: "text-3xl",
  36: "text-4xl",
  48: "text-5xl",
  60: "text-6xl",
  72: "text-7xl",
  96: "text-8xl",
  128: "text-9xl",
};

function suggest(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return "?";
  const px = raw.endsWith("rem") ? Math.round(num * 16) : Math.round(num);
  // Find nearest key
  const keys = Object.keys(PX_TO_CLASS).map(Number).sort((a, b) => a - b);
  let closest = keys.reduce((a, b) => Math.abs(b - px) < Math.abs(a - px) ? b : a);
  return `${PX_TO_CLASS[closest]} (≈${px}px)`;
}

interface Hit {
  file: string;
  line: number;
  kind: string;
  match: string;
  suggestion: string;
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) yield full;
  }
}

const hits: Hit[] = [];

for await (const file of walk(ROOT)) {
  const rel = relative(import.meta.dir, file);
  const lines = (await readFile(file, "utf8")).split("\n");

  lines.forEach((line, i) => {
    const lineNo = i + 1;

    // 1. Tailwind arbitrary: text-[13px] text-[0.9rem] text-[1.1em]
    for (const m of line.matchAll(/\btext-\[([^\]]+(?:px|rem|em|%)[^\]]*)\]/g)) {
      hits.push({ file: rel, line: lineNo, kind: "arbitrary class", match: m[0], suggestion: suggest(m[1]) });
    }

    // 2. JSX inline style fontSize
    for (const m of line.matchAll(/fontSize\s*:\s*["'`]?(\d+(?:\.\d+)?(?:px|rem|em)?)/g)) {
      hits.push({ file: rel, line: lineNo, kind: "inline style", match: `fontSize: ${m[1]}`, suggestion: suggest(m[1]) });
    }

    // 3. CSS font-size property
    for (const m of line.matchAll(/font-size\s*:\s*([^;}\n]+)/g)) {
      const val = m[1].trim();
      hits.push({ file: rel, line: lineNo, kind: "css property", match: `font-size: ${val}`, suggestion: suggest(val.split(" ")[0]) });
    }
  });
}

if (hits.length === 0) {
  console.log("No font-size inconsistencies found.");
  process.exit(0);
}

// Group by file
const byFile = new Map<string, Hit[]>();
for (const h of hits) {
  (byFile.get(h.file) ?? (byFile.set(h.file, []), byFile.get(h.file)!)).push(h);
}

console.log(`Found ${hits.length} hardcoded font-size${hits.length > 1 ? "s" : ""} across ${byFile.size} file${byFile.size > 1 ? "s" : ""}:\n`);

for (const [file, fileHits] of byFile) {
  console.log(`\x1b[1m${file}\x1b[0m`);
  for (const h of fileHits) {
    console.log(`  \x1b[33mL${h.line}\x1b[0m  [${h.kind}]  \x1b[31m${h.match}\x1b[0m  →  \x1b[32m${h.suggestion}\x1b[0m`);
  }
}

console.log(`\nTotal: ${hits.length} occurrences`);
