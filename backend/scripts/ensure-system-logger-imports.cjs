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

function addImportIfNeeded(source) {
  if (!source.includes("systemLogger.")) return source;
  if (source.includes("system-logger")) return source;

  const firstImportIndex = source.search(/^import\s/m);
  if (firstImportIndex === -1) {
    return `${SYSTEM_LOGGER_IMPORT}${source}`;
  }

  return `${source.slice(0, firstImportIndex)}${SYSTEM_LOGGER_IMPORT}${source.slice(
    firstImportIndex,
  )}`;
}

const changed = [];
for (const filePath of walk(SRC_ROOT)) {
  const original = fs.readFileSync(filePath, "utf8");
  const next = addImportIfNeeded(original);
  if (next !== original) {
    fs.writeFileSync(filePath, next);
    changed.push(path.relative(ROOT, filePath));
  }
}

console.log(`Updated ${changed.length} files.`);
for (const file of changed) {
  console.log(file);
}
