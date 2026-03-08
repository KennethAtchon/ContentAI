#!/usr/bin/env bun
/**
 * Detects and fixes broken i18next interpolation in translation files.
 *
 * react-i18next requires double braces: {{variable}}
 * Single braces {variable} are NOT interpolated — they render literally.
 *
 * Usage:
 *   bun scripts/fix-i18n-interpolation.ts          # detect only
 *   bun scripts/fix-i18n-interpolation.ts --fix    # detect and fix
 */

const TRANSLATIONS_PATH = `${import.meta.dir}/../src/translations/en.json`;

// Matches {word} but not {{word}} — uses negative lookbehind/lookahead
const SINGLE_BRACE_RE = /(?<!\{)\{([a-zA-Z_]\w*)\}(?!\})/g;

async function detectAndFix(fix: boolean) {
  const raw = await Bun.file(TRANSLATIONS_PATH).text();
  const translations: Record<string, string> = JSON.parse(raw);

  const broken: Array<{ key: string; value: string; fixed: string }> = [];
  const fixedTranslations: Record<string, string> = {};

  for (const [key, value] of Object.entries(translations)) {
    if (typeof value !== "string") {
      fixedTranslations[key] = value;
      continue;
    }

    if (SINGLE_BRACE_RE.test(value)) {
      SINGLE_BRACE_RE.lastIndex = 0; // reset stateful regex
      const fixed = value.replace(SINGLE_BRACE_RE, "{{$1}}");
      broken.push({ key, value, fixed });
      fixedTranslations[key] = fix ? fixed : value;
    } else {
      fixedTranslations[key] = value;
    }
  }

  if (broken.length === 0) {
    console.log("✅ No broken interpolations found.");
    return;
  }

  console.log(
    `${fix ? "🔧 Fixed" : "❌ Found"} ${broken.length} broken interpolation(s):\n`
  );

  for (const { key, value, fixed } of broken) {
    console.log(`  Key:    ${key}`);
    console.log(`  Before: ${value}`);
    console.log(`  After:  ${fixed}`);
    console.log();
  }

  if (fix) {
    const output = JSON.stringify(fixedTranslations, null, 2) + "\n";
    await Bun.write(TRANSLATIONS_PATH, output);
    console.log(`✅ Written: ${TRANSLATIONS_PATH}`);
  } else {
    console.log("Run with --fix to apply corrections.");
  }
}

const shouldFix = Bun.argv.includes("--fix");
detectAndFix(shouldFix);
