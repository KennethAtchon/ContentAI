import type { Typography } from "./types";

export function applyTextTransform(
  text: string,
  textTransform: Typography["textTransform"],
): string {
  switch (textTransform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    default:
      return text;
  }
}
