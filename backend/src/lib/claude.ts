import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "../utils/config/envUtil";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const promptCache: Record<string, string> = {};

/**
 * Load a prompt file by name from src/prompts/.
 * Results are cached in memory after first read.
 */
export function loadPrompt(name: string): string {
  if (promptCache[name]) return promptCache[name];

  const filePath = join(import.meta.dir, "../prompts", `${name}.txt`);
  if (!existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${name}.txt`);
  }

  const content = readFileSync(filePath, "utf-8").trim();
  promptCache[name] = content;
  return content;
}
