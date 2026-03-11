#!/usr/bin/env bun
// verify-migration.ts
// Verifies migration completeness

import { existsSync, statSync } from "fs";
import { glob } from "glob";
import path from "path";

const PROJECT_DIR =
  "/home/kenneth/Documents/Workplace/WebsiteTemplate2/project";
const FRONTEND_DIR =
  "/home/kenneth/Documents/Workplace/WebsiteTemplate2/frontend/src";

interface VerificationResult {
  category: string;
  expected: number;
  actual: number;
  missing: string[];
  status: "pass" | "fail" | "warning";
}

async function verifyComponents(): Promise<VerificationResult> {
  const projectComponents = await glob(
    `${PROJECT_DIR}/shared/components/**/*.tsx`
  );
  const frontendComponents = await glob(
    `${FRONTEND_DIR}/shared/components/**/*.tsx`
  );

  const projectSet = new Set(projectComponents.map((f) => path.basename(f)));
  const frontendSet = new Set(frontendComponents.map((f) => path.basename(f)));

  const missing = [...projectSet].filter((f) => !frontendSet.has(f));

  return {
    category: "Components",
    expected: projectComponents.length,
    actual: frontendComponents.length,
    missing,
    status: missing.length === 0 ? "pass" : "warning",
  };
}

async function verifyFeatures(): Promise<VerificationResult> {
  const features = [
    "account",
    "admin",
    "auth",
    "studio tool",
    "contact",
    "customers",
    "faq",
    "orders",
    "payments",
    "subscriptions",
  ];

  const missing: string[] = [];

  for (const feature of features) {
    const projectPath = `${PROJECT_DIR}/features/${feature}`;
    const frontendPath = `${FRONTEND_DIR}/features/${feature}`;

    if (!existsSync(frontendPath)) {
      missing.push(feature);
    }
  }

  return {
    category: "Features",
    expected: features.length,
    actual: features.length - missing.length,
    missing,
    status: missing.length === 0 ? "pass" : "fail",
  };
}

async function verifyStructure(): Promise<VerificationResult> {
  const requiredDirs = [
    "shared/components",
    "shared/constants",
    "shared/contexts",
    "shared/hooks",
    "shared/lib",
    "shared/providers",
    "shared/services",
    "shared/types",
    "shared/utils",
    "features",
    "styles",
  ];

  const missing = requiredDirs.filter(
    (dir) => !existsSync(`${FRONTEND_DIR}/${dir}`)
  );

  return {
    category: "Folder Structure",
    expected: requiredDirs.length,
    actual: requiredDirs.length - missing.length,
    missing,
    status: missing.length === 0 ? "pass" : "fail",
  };
}

async function verifyConfig(): Promise<VerificationResult> {
  const requiredFiles = [
    "tsconfig.json",
    "tailwind.config.ts",
    "vite.config.ts",
    "package.json",
    ".env.example",
  ];

  const missing = requiredFiles.filter(
    (file) => !existsSync(`${FRONTEND_DIR}/../${file}`)
  );

  return {
    category: "Configuration Files",
    expected: requiredFiles.length,
    actual: requiredFiles.length - missing.length,
    missing,
    status: missing.length === 0 ? "pass" : "warning",
  };
}

async function main() {
  console.log("🔍 Verifying migration completeness...\n");

  const results = await Promise.all([
    verifyStructure(),
    verifyComponents(),
    verifyFeatures(),
    verifyConfig(),
  ]);

  console.log("📊 Verification Results:\n");

  for (const result of results) {
    const icon =
      result.status === "pass"
        ? "✅"
        : result.status === "warning"
          ? "⚠️"
          : "❌";

    console.log(`${icon} ${result.category}`);
    console.log(`   Expected: ${result.expected}`);
    console.log(`   Actual: ${result.actual}`);

    if (result.missing.length > 0) {
      console.log(`   Missing: ${result.missing.join(", ")}`);
    }
    console.log("");
  }

  const allPassed = results.every((r) => r.status === "pass");
  const hasWarnings = results.some((r) => r.status === "warning");

  if (allPassed) {
    console.log("✅ All verifications passed!");
  } else if (hasWarnings) {
    console.log("⚠️  Some warnings found. Review and address as needed.");
  } else {
    console.log("❌ Some verifications failed. Please address the issues.");
    process.exit(1);
  }
}

main().catch(console.error);
