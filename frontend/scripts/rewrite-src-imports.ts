#!/usr/bin/env bun

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative, resolve } from "node:path";

type Rewrite = readonly [RegExp, string];
type UnresolvedImport = {
  file: string;
  line: number;
  specifier: string;
};

const ROOT = resolve(import.meta.dir, "..");
const SRC_ROOT = join(ROOT, "src");
const SOURCE_ROOTS = [SRC_ROOT, join(ROOT, "__tests__")];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".json", ".css"];
const IGNORED_DIRS = new Set([
  ".git",
  ".tanstack",
  "coverage",
  "dist",
  "node_modules",
]);

const checkOnly = process.argv.includes("--check");

const importPathRewrites: Rewrite[] = [
  [/@\/features\//g, "@/domains/"],
  [/@\/domains\/([^/]+)\/components\//g, "@/domains/$1/ui/"],
  [/@\/domains\/([^/]+)\/services\//g, "@/domains/$1/api/"],
  [/@\/domains\/([^/]+)\/types(?=\/|["'])/g, "@/domains/$1/model"],
  [/@\/domains\/([^/]+)\/utils\//g, "@/domains/$1/lib/"],
  [/@\/domains\/audio\/contexts\//g, "@/domains/audio/state/"],

  [/@\/shared\/components\/ui\//g, "@/shared/ui/primitives/"],
  [/@\/shared\/components\/layout\//g, "@/shared/ui/layout/"],
  [/@\/shared\/components\/data-display\//g, "@/shared/ui/data-display/"],
  [/@\/shared\/components\/feedback\//g, "@/shared/ui/feedback/"],
  [/@\/shared\/components\/navigation\//g, "@/shared/ui/navigation/"],
  [/@\/shared\/components\/marketing\//g, "@/shared/marketing/ui/"],
  [/@\/shared\/components\/analytics\//g, "@/shared/observability/ui/"],
  [/@\/shared\/components\/debug\//g, "@/shared/debug/ui/"],
  [/@\/shared\/components\/saas\//g, "@/domains/subscriptions/ui/"],
  [/@\/shared\/components\/theme-toggle/g, "@/shared/ui/theme-toggle"],
  [/@\/shared\/components\/query-provider/g, "@/app/query/query-provider"],

  [/@\/shared\/contexts\//g, "@/app/state/"],
  [/@\/shared\/providers\/theme-provider/g, "@/app/providers/theme-provider"],
  [/@\/shared\/hooks\//g, "@/shared/react/"],
  [/@\/shared\/lib\/query-client/g, "@/app/query/query-client"],
  [/@\/shared\/lib\/query-keys/g, "@/app/query/query-keys"],
  [/@\/shared\/lib\/query-invalidation/g, "@/app/query/query-invalidation"],
  [/@\/shared\/lib\/route-data-prefetch/g, "@/app/query/route-data-prefetch"],
  [/@\/shared\/lib\/i18n/g, "@/app/i18n/i18n"],
  [/@\/shared\/i18n\/config/g, "@/app/i18n/config"],
  [/@\/shared\/lib\/firebase/g, "@/shared/platform/firebase"],

  [/@\/shared\/services\/api\//g, "@/shared/api/"],
  [/@\/shared\/services\/firebase\//g, "@/shared/platform/firebase-services/"],
  [/@\/shared\/services\/monitoring\//g, "@/shared/observability/"],
  [/@\/shared\/services\/seo\//g, "@/shared/seo/"],
  [/@\/shared\/services\/timezone\//g, "@/shared/time/timezone/"],
  [/@\/shared\/services\/sentry/g, "@/shared/observability/sentry"],

  [/@\/shared\/utils\/api\//g, "@/shared/api/"],
  [/@\/shared\/utils\/config\//g, "@/shared/config/"],
  [/@\/shared\/utils\/debug(?=\/|["'])/g, "@/shared/debug"],
  [/@\/shared\/utils\/error-handling\//g, "@/shared/errors/"],
  [/@\/shared\/utils\/helpers\//g, "@/shared/lib/"],
  [/@\/shared\/utils\/permissions\//g, "@/shared/permissions/"],
  [/@\/shared\/utils\/redirect\//g, "@/shared/navigation/"],
  [/@\/shared\/utils\/security\//g, "@/shared/security/"],
  [/@\/shared\/utils\/system\//g, "@/shared/system/"],
  [/@\/shared\/utils\/type-guards\//g, "@/shared/type-guards/"],
  [
    /@\/shared\/utils\/stripe-map-loader/g,
    "@/shared/payments/stripe-map-loader",
  ],
];

const relativeDomainRewrites: Rewrite[] = [
  [/from\s+(["'])\.\.\/services\//g, "from $1../api/"],
  [/from\s+(["'])\.\.\/types(?=\/|["'])/g, "from $1../model"],
  [/from\s+(["'])\.\.\/utils\//g, "from $1../lib/"],
  [/from\s+(["'])\.\.\/contexts\//g, "from $1../state/"],
  [/from\s+(["'])\.\.\/\.\.\/services\//g, "from $1../../api/"],
  [/from\s+(["'])\.\.\/\.\.\/types(?=\/|["'])/g, "from $1../../model"],
  [/from\s+(["'])\.\.\/\.\.\/utils\//g, "from $1../../lib/"],
  [/from\s+(["'])\.\.\/\.\.\/contexts\//g, "from $1../../state/"],
];

function listFiles(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];

  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...listFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function applyRewrites(content: string, rewrites: readonly Rewrite[]): string {
  return rewrites.reduce(
    (updated, [pattern, replacement]) => updated.replace(pattern, replacement),
    content
  );
}

function lineFromIndex(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function aliasImportExists(specifier: string): boolean {
  if (!specifier.startsWith("@/")) return true;

  const withoutAlias = specifier.slice(2);
  const basePath = join(SRC_ROOT, withoutAlias);

  for (const extension of RESOLVE_EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return true;
  }

  for (const extension of RESOLVE_EXTENSIONS.slice(1)) {
    const candidate = join(basePath, `index${extension}`);
    if (existsSync(candidate) && statSync(candidate).isFile()) return true;
  }

  return false;
}

function findAliasImports(content: string, file: string): UnresolvedImport[] {
  const unresolved: UnresolvedImport[] = [];
  const importRegex =
    /(?:from\s+["']|import\s*\(\s*["']|import\s+["'])(@\/[^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const beforeImportOnLine = content.slice(lineStart, match.index);
    if (beforeImportOnLine.includes("//")) continue;

    const specifier = match[1];
    if (!aliasImportExists(specifier)) {
      unresolved.push({
        file: relative(ROOT, file),
        line: lineFromIndex(content, match.index),
        specifier,
      });
    }
  }

  return unresolved;
}

const files = SOURCE_ROOTS.flatMap(listFiles);
let changedFiles = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let updated = applyRewrites(original, importPathRewrites);

  if (file.startsWith(join(SRC_ROOT, "domains"))) {
    updated = applyRewrites(updated, relativeDomainRewrites);
  }

  if (updated !== original) {
    changedFiles++;
    console.log(
      `${checkOnly ? "would rewrite" : "rewrote"} ${relative(ROOT, file)}`
    );
    if (!checkOnly) writeFileSync(file, updated);
  }
}

const unresolved = files.flatMap((file) =>
  findAliasImports(readFileSync(file, "utf8"), file)
);

if (changedFiles === 0) {
  console.log("no import rewrites needed");
}

if (unresolved.length > 0) {
  console.error("\nunresolved @/ imports:");
  for (const item of unresolved) {
    console.error(`${item.file}:${item.line} ${item.specifier}`);
  }
  process.exitCode = 1;
} else {
  console.log("all @/ imports resolve");
}

if (checkOnly && changedFiles > 0) {
  process.exitCode = 1;
}
