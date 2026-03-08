/**
 * Template config: product identity and core feature routing.
 * Change these first when using this project as a template.
 */
export const APP_NAME = "CalcPro";
export const APP_DESCRIPTION =
  "Professional financial calculators for modern businesses";
export const APP_TAGLINE =
  "Professional financial calculators for modern businesses";
export const SUPPORT_EMAIL = "support@calcpro.com";

/** Support phone for contact/structured data. Change for your product. */
export const SUPPORT_PHONE = "+1-555-0100";

/**
 * Slug for the main app feature (used in URLs and API paths).
 * Default: "calculator". Change to "tools", "documents", etc. when building a different product.
 */
export const CORE_FEATURE_SLUG = "calculator";

/** Main app path for the core feature (e.g. /calculator). Use for links and redirects. */
export const CORE_FEATURE_PATH = `/${CORE_FEATURE_SLUG}` as const;

/** API prefix for the core feature (e.g. /api/calculator). Use for API calls. */
export const CORE_FEATURE_API_PREFIX = `/api/${CORE_FEATURE_SLUG}` as const;
