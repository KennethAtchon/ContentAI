import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(import.meta.dir, "..");
const TRANSLATIONS_FILE = path.join(ROOT, "src", "translations", "en.json");

const rawJson = fs.readFileSync(TRANSLATIONS_FILE, "utf-8");
const translations = JSON.parse(rawJson);
let fixedCount = 0;

for (const key of Object.keys(translations)) {
  const value = translations[key];
  if (typeof value === "string" && value.includes("[TODO]")) {
    // Split key by underscores (e.g. "studio_tabs_generate")
    let words = key.split(/[_]+/);

    // Capitalize each word
    const finalValue = words
      .filter((w) => w.length > 0)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    translations[key] = finalValue;
    fixedCount++;
  }
}

fs.copyFileSync(TRANSLATIONS_FILE, TRANSLATIONS_FILE + ".pre-fill");
fs.writeFileSync(
  TRANSLATIONS_FILE,
  JSON.stringify(translations, null, 2) + "\n"
);

console.log(
  `✅ Filled ${fixedCount} [TODO] placeholders with readable default text.`
);
