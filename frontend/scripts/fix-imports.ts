#!/usr/bin/env bun
// fix-imports.ts
// Automatically updates import paths after folder reorganization

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";
import path from "path";

const FRONTEND_DIR =
  "/home/kenneth/Documents/Workplace/WebsiteTemplate2/frontend/src";

interface ImportReplacement {
  pattern: RegExp;
  replacement: string;
  description: string;
}

const replacements: ImportReplacement[] = [
  {
    pattern: /from ["']@\/components\//g,
    replacement: 'from "@/shared/components/',
    description: "components -> shared/components",
  },
  {
    pattern: /from ["']@\/constants\//g,
    replacement: 'from "@/shared/constants/',
    description: "constants -> shared/constants",
  },
  {
    pattern: /from ["']@\/contexts\//g,
    replacement: 'from "@/shared/contexts/',
    description: "contexts -> shared/contexts",
  },
  {
    pattern: /from ["']@\/hooks\//g,
    replacement: 'from "@/shared/hooks/',
    description: "hooks -> shared/hooks",
  },
  {
    pattern: /from ["']@\/lib\//g,
    replacement: 'from "@/shared/lib/',
    description: "lib -> shared/lib",
  },
  {
    pattern: /from ["']@\/providers\//g,
    replacement: 'from "@/shared/providers/',
    description: "providers -> shared/providers",
  },
  {
    pattern: /from ["']@\/services\//g,
    replacement: 'from "@/shared/services/',
    description: "services -> shared/services",
  },
  {
    pattern: /from ["']@\/types\//g,
    replacement: 'from "@/shared/types/',
    description: "types -> shared/types",
  },
  {
    pattern: /from ["']@\/utils\//g,
    replacement: 'from "@/shared/utils/',
    description: "utils -> shared/utils",
  },
];

async function fixImports() {
  console.log("🔍 Finding TypeScript/TSX files...");

  const files = await glob(`${FRONTEND_DIR}/**/*.{ts,tsx}`, {
    ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts"],
  });

  console.log(`📝 Found ${files.length} files to process`);

  let totalChanges = 0;
  let filesModified = 0;

  for (const file of files) {
    let content = readFileSync(file, "utf8");
    let modified = false;
    let fileChanges = 0;

    for (const { pattern, replacement, description } of replacements) {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        modified = true;
        fileChanges += matches.length;
      }
    }

    if (modified) {
      writeFileSync(file, content, "utf8");
      filesModified++;
      totalChanges += fileChanges;
      console.log(
        `✅ Updated: ${path.relative(FRONTEND_DIR, file)} (${fileChanges} changes)`
      );
    }
  }

  console.log("");
  console.log("📊 Summary:");
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Total changes: ${totalChanges}`);
  console.log("");
  console.log("✅ Import path transformation complete!");
}

fixImports().catch(console.error);
