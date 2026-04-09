#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";

type Occurrence = {
  file: string;
  line: number;
  kind: "literal" | "dynamic";
  detail?: string;
};

type UnresolvedTemplate = {
  file: string;
  line: number;
  template: string;
  variable: string;
};

const ROOT = path.resolve(import.meta.dir, "..");
const SRC_DIR = path.join(ROOT, "src");
const TRANSLATIONS_FILE = path.join(SRC_DIR, "translations", "en.json");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "translations",
  "coverage",
]);

function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        files.push(...listSourceFiles(fullPath));
      }
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineFromIndex(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function parseStringArrayValues(arrayBody: string): string[] {
  const values = new Set<string>();
  const stringRegex = /["'`]([^"'`]+)["'`]/g;
  let match: RegExpExecArray | null;

  while ((match = stringRegex.exec(arrayBody)) !== null) {
    values.add(match[1]);
  }

  return Array.from(values);
}

function addOccurrence(
  map: Map<string, Occurrence[]>,
  key: string,
  occurrence: Occurrence
): void {
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(occurrence);
}

function main(): void {
  const rawTranslations = fs.readFileSync(TRANSLATIONS_FILE, "utf8");
  const translations = JSON.parse(rawTranslations) as Record<string, string>;
  const translationKeys = new Set(Object.keys(translations));

  const lowerToRealKey = new Map<string, string>();
  for (const key of translationKeys) {
    const lower = key.toLowerCase();
    if (!lowerToRealKey.has(lower)) {
      lowerToRealKey.set(lower, key);
    }
  }

  const files = listSourceFiles(SRC_DIR);
  const usedKeys = new Map<string, Occurrence[]>();
  const unresolvedTemplates: UnresolvedTemplate[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const relFile = path.relative(ROOT, file);

    const constStringArrays = new Map<string, string[]>();
    const constArrayRegex =
      /const\s+([A-Za-z_][A-Za-z0-9_]*)[^=]*=\s*\[((?:.|\n)*?)\]\s*(?:as\s+const)?\s*;/g;
    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = constArrayRegex.exec(content)) !== null) {
      const name = arrayMatch[1];
      const values = parseStringArrayValues(arrayMatch[2]);
      if (values.length > 0) {
        constStringArrays.set(name, values);
      }
    }

    const iteratorVarValues = new Map<string, string[]>();
    const mapRegex =
      /([A-Za-z_][A-Za-z0-9_]*)\.map\(\s*\(?\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s*,[^)]*)?\s*\)?\s*=>/g;
    let mapMatch: RegExpExecArray | null;
    while ((mapMatch = mapRegex.exec(content)) !== null) {
      const arrayName = mapMatch[1];
      const iterVar = mapMatch[2];
      const values = constStringArrays.get(arrayName);
      if (values?.length) {
        iteratorVarValues.set(iterVar, values);
      }
    }

    const literalPatterns = [
      /(?:^|[^A-Za-z0-9_])t\(\s*"([^"]+)"\s*(?:,|\))/g,
      /(?:^|[^A-Za-z0-9_])t\(\s*'([^']+)'\s*(?:,|\))/g,
      /(?:^|[^A-Za-z0-9_])t\(\s*`([^`$]+)`\s*(?:,|\))/g,
    ];

    for (const pattern of literalPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const key = match[1];
        addOccurrence(usedKeys, key, {
          file: relFile,
          line: lineFromIndex(content, match.index),
          kind: "literal",
        });
      }
    }

    const dynamicTemplatePattern =
      /(?:^|[^A-Za-z0-9_])t\(\s*`([^`$]*)\$\{([A-Za-z_][A-Za-z0-9_]*)\}([^`]*)`\s*(?:,|\))/g;
    let dynamicMatch: RegExpExecArray | null;
    while ((dynamicMatch = dynamicTemplatePattern.exec(content)) !== null) {
      const prefix = dynamicMatch[1];
      const variable = dynamicMatch[2];
      const suffix = dynamicMatch[3];
      const line = lineFromIndex(content, dynamicMatch.index);

      const resolvedValues =
        iteratorVarValues.get(variable) ?? constStringArrays.get(variable);

      if (!resolvedValues || resolvedValues.length === 0) {
        unresolvedTemplates.push({
          file: relFile,
          line,
          template: `${prefix}\${${variable}}${suffix}`,
          variable,
        });
        continue;
      }

      for (const value of resolvedValues) {
        const key = `${prefix}${value}${suffix}`;
        addOccurrence(usedKeys, key, {
          file: relFile,
          line,
          kind: "dynamic",
          detail: `${variable} -> ${value}`,
        });
      }
    }
  }

  const missingKeys = Array.from(usedKeys.keys())
    .filter((key) => !translationKeys.has(key))
    .sort();

  const caseMismatches = missingKeys
    .map((missing) => {
      const found = lowerToRealKey.get(missing.toLowerCase());
      if (!found || found === missing) return null;
      return { missing, found };
    })
    .filter((x): x is { missing: string; found: string } => x !== null);

  console.log("\nTranslation Load Checker\n");
  console.log(`Scanned files: ${files.length}`);
  console.log(`Translation keys in en.json: ${translationKeys.size}`);

  console.log("\n=== Missing Translation Keys ===");
  if (missingKeys.length === 0) {
    console.log("None");
  } else {
    for (const key of missingKeys) {
      console.log(`- ${key}`);
      const occurrences = usedKeys.get(key) ?? [];
      for (const occ of occurrences.slice(0, 5)) {
        const extra = occ.detail ? ` (${occ.detail})` : "";
        console.log(`    ${occ.file}:${occ.line} [${occ.kind}]${extra}`);
      }
      if (occurrences.length > 5) {
        console.log(`    ... ${occurrences.length - 5} more`);
      }
    }
  }

  console.log("\n=== Likely Case Mismatches ===");
  if (caseMismatches.length === 0) {
    console.log("None");
  } else {
    for (const mismatch of caseMismatches) {
      console.log(`- ${mismatch.missing} -> did you mean ${mismatch.found}?`);
    }
  }

  console.log("\n=== Unresolved Dynamic Keys ===");
  if (unresolvedTemplates.length === 0) {
    console.log("None");
  } else {
    for (const item of unresolvedTemplates) {
      console.log(`- ${item.file}:${item.line} : t(\`${item.template}\`)`);
      console.log(`    unresolved variable: ${item.variable}`);
    }
  }

  const hasProblems =
    missingKeys.length > 0 ||
    caseMismatches.length > 0 ||
    unresolvedTemplates.length > 0;

  if (hasProblems) {
    console.log("\nResult: FAIL (missing/unresolved translation keys found)\n");
    process.exit(1);
  }

  console.log(
    "\nResult: PASS (all detected translation keys resolve to en.json)\n"
  );
}

main();
