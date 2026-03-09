/**
 * Template config: product identity and core feature routing.
 * Change these first when using this project as a template.
 */
export const APP_NAME = "ReelStudio";
export const APP_DESCRIPTION =
  "Discover viral reels, decode what works, and generate content that performs";
export const APP_TAGLINE =
  "Turn viral reels into your content strategy";
export const SUPPORT_EMAIL = "support@reelstudio.ai";

/** Support phone for contact/structured data. Change for your product. */
export const SUPPORT_PHONE = "+1-555-0100";

/**
 * Slug for the main app feature (used in URLs and API paths).
 */
export const CORE_FEATURE_SLUG = "studio";

/** Main app path for the core feature. */
export const CORE_FEATURE_PATH = "/studio/discover" as const;

/** API prefix for the core feature. */
export const CORE_FEATURE_API_PREFIX = `/api/reels` as const;
