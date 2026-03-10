#!/usr/bin/env node

/**
 * Translation Sync & Audit Script
 *
 * Usage:
 *   bun run scripts/sync-translations.ts              # Audit mode (dry-run)
 *   bun run scripts/sync-translations.ts --fix        # Fix mode (writes changes)
 *   bun run scripts/sync-translations.ts --verbose    # Show all details
 *
 * What it does:
 *   1. Finds all t("key") calls in source code
 *   2. Reports translation keys that exist in en.json but are NOT used (dead keys)
 *   3. Reports t("key") calls in source with NO matching translation (missing keys)
 *   4. Reports stale CalcPro/calculator terminology in translation values
 *   5. Reports hardcoded user-facing strings that should use t()
 *   6. With --fix: removes dead keys and adds placeholder entries for missing keys
 */

import * as fs from "fs";
import * as path from "path";

// ── Config ─────────────────────────────────────────────────────────
const ROOT = path.resolve(import.meta.dir, "..");
const SRC_DIR = path.join(ROOT, "src");
const TRANSLATIONS_FILE = path.join(SRC_DIR, "translations", "en.json");
const FIX_MODE = process.argv.includes("--fix");
const VERBOSE = process.argv.includes("--verbose");

// Patterns that indicate stale/old branding in translation VALUES
const STALE_PATTERNS = [
  /calcpro/i,
  /\bcalculator\b/i,
  /\bcalculators\b/i,
  /\bfinancial calculator/i,
  /\bprofessional financial/i,
];

// File extensions to scan for t() calls and hardcoded strings
const SOURCE_EXTENSIONS = [".tsx", ".ts"];
const IGNORE_DIRS = [
  "node_modules",
  "dist",
  ".git",
  "translations",
  "__tests__",
  "test",
];

// Patterns to extract translation key usage from source code
// Matches: t("key"), t('key'), t("key", ...), t(`key`)
const T_CALL_PATTERNS = [
  /\bt\(\s*"([^"]+)"/g,
  /\bt\(\s*'([^']+)'/g,
  /\bt\(\s*`([^`]+)`/g,
];

// Patterns for hardcoded strings that should probably be translated
// Only checks JSX text content and common string props
const HARDCODED_PATTERNS = [
  // JSX text between tags: >Some text<
  {
    regex: />\s*([A-Z][a-z]+(?:\s+[a-z]+){2,})\s*</g,
    desc: "JSX text content",
  },
  // title="..." or placeholder="..." with literal text
  {
    regex: /(?:title|placeholder|aria-label|alt)="([A-Z][a-zA-Z\s]{8,})"/g,
    desc: "HTML attribute",
  },
];

// ── Helpers ────────────────────────────────────────────────────────
function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        results.push(...getAllSourceFiles(fullPath));
      }
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractUsedKeys(
  files: string[],
  allKeys: Set<string>
): Map<string, string[]> {
  const keyToFiles = new Map<string, string[]>();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const relPath = path.relative(ROOT, file);

    // 1. First, check direct t("key") calls using regexes to find NEW keys not in en.json
    for (const pattern of T_CALL_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        if (!keyToFiles.has(key)) keyToFiles.set(key, []);
        if (!keyToFiles.get(key)!.includes(relPath)) {
          keyToFiles.get(key)!.push(relPath);
        }
      }
    }

    // 2. Second, scan for any known key from en.json appearing as a string literal in the file
    // This catches patterns like: labelKey: "navigation_features"
    for (const key of allKeys) {
      if (
        content.includes(`"${key}"`) ||
        content.includes(`'${key}'`) ||
        content.includes(`\`${key}\``)
      ) {
        if (!keyToFiles.has(key)) keyToFiles.set(key, []);
        if (!keyToFiles.get(key)!.includes(relPath)) {
          keyToFiles.get(key)!.push(relPath);
        }
      }
    }
  }
  return keyToFiles;
}

function findHardcodedStrings(
  files: string[]
): Array<{ file: string; line: number; text: string; type: string }> {
  const results: Array<{
    file: string;
    line: number;
    text: string;
    type: string;
  }> = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    const relPath = path.relative(ROOT, file);

    // Skip test files, config files, type files
    if (
      relPath.includes("__test") ||
      relPath.includes(".test.") ||
      relPath.includes(".d.ts") ||
      relPath.includes("constants") ||
      relPath.includes("config") ||
      relPath.includes("types") ||
      relPath.includes("utils") ||
      relPath.includes("hooks") ||
      relPath.includes("services") ||
      relPath.includes("lib/") ||
      relPath.includes("contexts")
    )
      continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip imports, comments, console logs, debug, className, key=, etc.
      if (
        /^\s*(import|\/\/|\/\*|\*|console|debug|className|key=|type |interface |export type)/.test(
          line
        )
      )
        continue;
      if (/\bt\(/.test(line)) continue; // Already using t()

      for (const { regex, desc } of HARDCODED_PATTERNS) {
        const re = new RegExp(regex.source, regex.flags);
        let match;
        while ((match = re.exec(line)) !== null) {
          const text = match[1].trim();
          // Skip things that look like code, CSS classes, or are very short
          if (text.length < 10) continue;
          if (/[{}()=><\/]/.test(text)) continue;
          if (
            /^(className|onClick|onChange|onSubmit|variant|size|type|href|to|id|key|ref|style)/.test(
              text
            )
          )
            continue;
          results.push({ file: relPath, line: i + 1, text, type: desc });
        }
      }
    }
  }
  return results;
}

// ── Main ───────────────────────────────────────────────────────────
function main() {
  console.log("\n🔍 Translation Sync & Audit Script\n");
  console.log(
    `   Mode: ${FIX_MODE ? "🔧 FIX (will write changes)" : "👀 AUDIT (dry-run)"}`
  );
  console.log(`   Source: ${path.relative(ROOT, SRC_DIR)}`);
  console.log(`   Translations: ${path.relative(ROOT, TRANSLATIONS_FILE)}\n`);

  // Load translations
  const rawJson = fs.readFileSync(TRANSLATIONS_FILE, "utf-8");
  const translations: Record<string, string> = JSON.parse(rawJson);
  const allTranslationKeys = new Set(Object.keys(translations));

  // Scan source files
  const sourceFiles = getAllSourceFiles(SRC_DIR);
  console.log(`   📁 Scanned ${sourceFiles.length} source files\n`);

  // Extract used keys (passing allTranslationKeys to catch string literal usages in configs)
  const usedKeysMap = extractUsedKeys(sourceFiles, allTranslationKeys);
  const usedKeys = new Set(usedKeysMap.keys());

  // ── 1. Dead keys (in JSON but not used in code) ──────────────
  const deadKeys: string[] = [];
  for (const key of allTranslationKeys) {
    if (!usedKeys.has(key)) deadKeys.push(key);
  }
  deadKeys.sort();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🗑️  DEAD KEYS (in en.json but never used): ${deadKeys.length}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (VERBOSE || deadKeys.length <= 30) {
    for (const key of deadKeys) {
      console.log(`   ❌ ${key}`);
      if (VERBOSE)
        console.log(`      Value: "${translations[key]?.substring(0, 60)}..."`);
    }
  } else {
    for (const key of deadKeys.slice(0, 20)) {
      console.log(`   ❌ ${key}`);
    }
    console.log(
      `   ... and ${deadKeys.length - 20} more (use --verbose to see all)`
    );
  }

  // ── 2. Missing keys (used in code but not in JSON) ───────────
  const missingKeys: string[] = [];
  for (const key of usedKeys) {
    if (!allTranslationKeys.has(key)) missingKeys.push(key);
  }
  missingKeys.sort();

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(
    `❓ MISSING KEYS (used in code but not in en.json): ${missingKeys.length}`
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const key of missingKeys) {
    const files = usedKeysMap.get(key) || [];
    console.log(`   ⚠️  ${key}`);
    if (VERBOSE) {
      for (const f of files) console.log(`      Used in: ${f}`);
    }
  }

  // ── 3. Stale CalcPro/calculator terminology ──────────────────
  const staleEntries: Array<{ key: string; value: string; pattern: string }> =
    [];
  for (const [key, value] of Object.entries(translations)) {
    for (const pattern of STALE_PATTERNS) {
      if (pattern.test(value)) {
        staleEntries.push({ key, value, pattern: pattern.source });
        break;
      }
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(
    `🏚️  STALE TERMINOLOGY (CalcPro/calculator references): ${staleEntries.length}`
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const { key, value } of staleEntries) {
    const shortVal = value.length > 80 ? value.substring(0, 80) + "..." : value;
    console.log(`   🔄 ${key}`);
    console.log(`      "${shortVal}"`);
  }

  // ── 4. Hardcoded strings ─────────────────────────────────────
  const hardcoded = findHardcodedStrings(sourceFiles);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📝 POTENTIAL HARDCODED STRINGS: ${hardcoded.length}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (hardcoded.length > 0) {
    const shown = VERBOSE ? hardcoded : hardcoded.slice(0, 25);
    for (const { file, line, text, type } of shown) {
      console.log(`   📌 ${file}:${line} (${type})`);
      console.log(`      "${text}"`);
    }
    if (!VERBOSE && hardcoded.length > 25) {
      console.log(
        `   ... and ${hardcoded.length - 25} more (use --verbose to see all)`
      );
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Total translation keys:    ${allTranslationKeys.size}`);
  console.log(`   Keys used in source:       ${usedKeys.size}`);
  console.log(`   🗑️  Dead keys (removable):  ${deadKeys.length}`);
  console.log(`   ❓ Missing keys:            ${missingKeys.length}`);
  console.log(`   🏚️  Stale values:            ${staleEntries.length}`);
  console.log(`   📝 Hardcoded strings:       ${hardcoded.length}`);

  // ── Fix mode ─────────────────────────────────────────────────
  if (FIX_MODE) {
    console.log("\n🔧 Applying fixes...\n");

    // Backup original
    const backupPath = TRANSLATIONS_FILE + ".backup";
    fs.copyFileSync(TRANSLATIONS_FILE, backupPath);
    console.log(`   ✅ Backup saved: ${path.relative(ROOT, backupPath)}`);

    // Build new translations object
    const cleaned: Record<string, string> = {};
    let removedCount = 0;
    let staleFixedCount = 0;

    // Keep only used keys, fix stale terminology
    for (const key of Object.keys(translations).sort()) {
      // Skip dead keys
      if (!usedKeys.has(key)) {
        removedCount++;
        continue;
      }

      let value = translations[key];

      // Fix stale terminology in values
      value = value.replace(/CalcPro/g, "ReelStudio");
      value = value.replace(/calcpro/g, "reelstudio");
      value = value.replace(
        /Professional Financial Calculators/gi,
        "AI-Powered Content Intelligence"
      );
      value = value.replace(
        /financial calculator/gi,
        "content intelligence tool"
      );
      value = value.replace(
        /financial calculators/gi,
        "content intelligence tools"
      );
      value = value.replace(/\bcalculator\b/gi, (match) => {
        // Preserve case
        if (match === "Calculator") return "Studio";
        if (match === "calculator") return "studio";
        if (match === "CALCULATOR") return "STUDIO";
        return "Studio";
      });
      value = value.replace(/\bcalculators\b/gi, (match) => {
        if (match === "Calculators") return "Tools";
        if (match === "calculators") return "tools";
        return "Tools";
      });

      if (value !== translations[key]) staleFixedCount++;
      cleaned[key] = value;
    }

    // Add placeholders for missing keys
    let addedCount = 0;
    for (const key of missingKeys.sort()) {
      // Generate a human-readable placeholder from the key name
      const placeholder = `[TODO] ${key.replace(/_/g, " ")}`;
      cleaned[key] = placeholder;
      addedCount++;
    }

    // Write sorted output
    const sortedCleaned: Record<string, string> = {};
    for (const key of Object.keys(cleaned).sort()) {
      sortedCleaned[key] = cleaned[key];
    }

    fs.writeFileSync(
      TRANSLATIONS_FILE,
      JSON.stringify(sortedCleaned, null, 2) + "\n"
    );

    console.log(`   ✅ Removed ${removedCount} dead keys`);
    console.log(`   ✅ Fixed ${staleFixedCount} stale values`);
    console.log(
      `   ✅ Added ${addedCount} placeholder entries for missing keys`
    );
    console.log(`   ✅ Sorted all keys alphabetically`);
    console.log(`\n   Final key count: ${Object.keys(sortedCleaned).length}`);
    console.log(`   File: ${path.relative(ROOT, TRANSLATIONS_FILE)}`);
  } else {
    console.log(
      `\n💡 Run with --fix to auto-fix: remove dead keys, fix stale values, add missing placeholders`
    );
    console.log(`   bun run scripts/sync-translations.ts --fix\n`);
  }
}

main();
