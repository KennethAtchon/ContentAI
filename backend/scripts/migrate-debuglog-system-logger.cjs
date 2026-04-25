#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_ROOT = path.join(ROOT, "src");
const SYSTEM_LOGGER_IMPORT =
  'import { systemLogger } from "@/utils/system/system-logger";\n';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function removeDebugLogImport(source) {
  return source.replace(
    /^import\s+(?:\{\s*debugLog\s*\}|debugLog)\s+from\s+["'][^"']*debug[^"']*["'];\n?/m,
    "",
  );
}

function insertSystemLoggerImport(source) {
  if (source.includes("system-logger")) return source;

  const firstImportIndex = source.search(/^import\s/m);
  if (firstImportIndex === -1) {
    return `${SYSTEM_LOGGER_IMPORT}${source}`;
  }

  return `${source.slice(0, firstImportIndex)}${SYSTEM_LOGGER_IMPORT}${source.slice(
    firstImportIndex,
  )}`;
}

function migrateFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  if (
    !original.includes("debugLog.error(") &&
    !original.includes("debugLog.warn(")
  ) {
    return false;
  }

  let next = original
    .replace(/\bdebugLog\.error\(/g, "systemLogger.error(")
    .replace(/\bdebugLog\.warn\(/g, "systemLogger.warn(");

  next = insertSystemLoggerImport(next);

  const stillUsesDebugLog =
    /\bdebugLog\.(info|debug|error|warn)\(/.test(next) || /\bdebugLog\(/.test(next);

  if (!stillUsesDebugLog) {
    next = removeDebugLogImport(next);
  }

  if (next === original) {
    return false;
  }

  fs.writeFileSync(filePath, next);
  return true;
}

const changed = [];
for (const filePath of walk(SRC_ROOT)) {
  if (migrateFile(filePath)) {
    changed.push(path.relative(ROOT, filePath));
  }
}

console.log(`Updated ${changed.length} files.`);
for (const file of changed) {
  console.log(file);
}
