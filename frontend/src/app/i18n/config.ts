export const locales = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ja",
  "zh",
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeMetadata: Record<
  Locale,
  { name: string; nativeName: string; flag: string }
> = {
  en: { name: "English", nativeName: "English", flag: "🇺🇸" },
  es: { name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  fr: { name: "French", nativeName: "Français", flag: "🇫🇷" },
  de: { name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  it: { name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  pt: { name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  ja: { name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  zh: { name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
