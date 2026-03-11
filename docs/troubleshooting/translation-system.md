# Translation System Documentation

## Overview

This project uses **next-intl** (v4.5.8) for internationalization (i18n). The system supports multiple languages with a flat key structure using underscores, automatic translation injection, and locale detection via cookies/headers (no locale in URLs).

## Architecture

### Core Components

1. **Translation Files**: JSON files in `project/translations/` directory
2. **i18n Configuration**: `project/shared/i18n/config.ts`
3. **Middleware**: `project/middleware.ts` (handles locale detection)
4. **Root Layout**: `project/app/layout.tsx` (provides translations to app)
5. **Helper Scripts**: Automation scripts in `project/scripts/`

### Supported Locales

Currently configured for 8 languages:

- `en` - English (default)
- `es` - Spanish
- `fr` - French
- `de` - German
- `pt` - Portuguese
- `it` - Italian
- `ja` - Japanese
- `zh` - Chinese

Locale metadata (names, flags, native names) is defined in `shared/i18n/config.ts`.

## Translation Key Structure

### Naming Convention

Translation keys use **underscores** (not dots) and follow a hierarchical namespace pattern:

```
{feature}_{component}_{element}
```

Examples:
- `common_cancel` - Common cancel button
- `navigation_home` - Navigation home link
- `generator_mortgage_title` - Hook Generator generator title
- `account_profile_email_address` - Account profile email field
- `auth_sign_in_description` - Sign-in page description

### Key Categories

1. **`common_*`** - Shared UI elements (buttons, labels, messages)
2. **`navigation_*`** - Navigation menu items
3. **`auth_*`** - Authentication pages (sign-in, sign-up)
4. **`generator_*`** - Generator components and features
5. **`account_*`** - Account management pages
6. **`subscription_*`** - Subscription-related content
7. **`checkout_*`** - Checkout flow
8. **`payment_*`** - Payment processing
9. **`admin_*`** - Admin dashboard
10. **`contact_*`** - Contact form and pages
11. **`faq_*`** - FAQ content
12. **`errors_*`** - Error messages
13. **`forms_*`** - Form validation messages

## Using Translations in Code

### Client Components

For React client components, use the `useTranslations` hook:

```typescript
"use client";

import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations();
  
  return (
    <div>
      <h1>{t("common_welcome_back")}</h1>
      <p>{t("common_description")}</p>
    </div>
  );
}
```

### Server Components

For server components (async components), use `getTranslations`:

```typescript
import { getTranslations } from "next-intl/server";

export default async function MyPage() {
  const t = await getTranslations();
  
  return (
    <div>
      <h1>{t("common_welcome_back")}</h1>
    </div>
  );
}
```

### Translation with Parameters

For dynamic content, pass parameters as the second argument:

```typescript
const t = useTranslations();

// In translation file: "checkout_save_percentage": "Save {percentage}%"
t("checkout_save_percentage", { percentage: 20 })

// In translation file: "account_subscription_plan_price": "{name} Plan - ${price}/{billingCycle}"
t("account_subscription_plan_price", { 
  name: "Pro", 
  price: 29.99, 
  billingCycle: "month" 
})
```

### JSX Attributes

For JSX attributes, use curly braces:

```typescript
<Button aria-label={t("common_close")}>
  {t("common_cancel")}
</Button>

// Or for attributes that expect strings
<input placeholder={t("forms_email")} />
```

### ⚠️ API Routes DO NOT Use Translations

**Important:** API route handlers (`/app/api/**/route.ts`) should **NOT** use translations.

#### Why API Routes Are Not Translated

1. **API Design Pattern**: REST APIs should be locale-agnostic
2. **Error Codes Over Messages**: HTTP status codes + error codes are the primary communication
3. **Client-Side Translation**: The UI layer handles translation of user-facing messages
4. **Consistency**: Backend-to-backend communication should be language-independent
5. **Simplicity**: Avoids complexity of determining locale for API consumers

#### Pattern for Error Handling

```typescript
// ❌ BAD: Do NOT use translations in API routes
import { getTranslations } from "next-intl/server";
export async function GET() {
  const t = await getTranslations();
  return NextResponse.json({ error: t("errors_user_not_found") }, { status: 404 });
}

// ✅ GOOD: Use English messages + error codes
import { createNotFoundResponse } from "@/shared/utils/api/response-helpers";
export async function GET() {
  return createNotFoundResponse("User not found");
  // Returns: { error: "User not found", code: "NOT_FOUND" }
}
```

#### Client-Side Translation Pattern

The client should translate API errors for display:

```typescript
// Client component handling API response
"use client";
import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations();
  
  const handleSubmit = async () => {
    const response = await fetch("/api/users");
    if (!response.ok) {
      const error = await response.json();
      
      // Translate error code to user-facing message
      const message = error.code === "NOT_FOUND" 
        ? t("errors_user_not_found")
        : t("errors_generic");
      
      toast.error(message);
    }
  };
}
```

#### Where Translations Apply

| Context | Use Translations | Reasoning |
|---------|------------------|-----------|
| Page Components | ✅ YES | User-facing UI content |
| UI Components | ✅ YES | Buttons, labels, tooltips |
| Client Components | ✅ YES | Interactive elements |
| Server Components | ✅ YES | SSR content for users |
| API Route Handlers | ❌ NO | Backend responses, not user-facing |
| Server Actions (returning data) | ❌ NO | Should return structured data |
| Validation Schemas | ❌ NO | Return error codes, translate in UI |

**See also:**
- `project/shared/i18n/config.ts` - Contains detailed documentation
- `project/shared/utils/api/response-helpers.ts` - API response patterns

## Locale Detection & Routing

### Configuration

The project uses **cookie-based locale detection** with no locale prefix in URLs (`localePrefix: "never"`).

**Important:** With `localePrefix: "never"`, locale detection is handled in `app/layout.tsx` using `getLocale()` from `next-intl/server`, **NOT in middleware**. The middleware is only used for security headers, CORS, and other request handling - not for locale routing.

```typescript
// app/layout.tsx
export default async function RootLayout({ children }) {
  // Locale detection happens here, not in middleware
  const locale = await getLocale(); // Reads from cookie or Accept-Language header
  const messages = await getMessages({ locale });
  
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Why no middleware routing?** When using `localePrefix: "never"`, routes stay at their original paths (e.g., `/about`, not `/en/about`). The middleware would incorrectly try to rewrite URLs to `/en/*`, causing 404 errors.

### How It Works

1. **First Visit**: Layout calls `getLocale()` which detects locale from `Accept-Language` header
2. **Cookie Storage**: Locale preference automatically stored in `NEXT_LOCALE` cookie by `next-intl`
3. **Subsequent Visits**: `getLocale()` reads cookie to determine locale
4. **Language Switcher**: Updates cookie and reloads page

### Language Switcher

The `LanguageSwitcher` component allows users to change languages:

```typescript
// Sets cookie and reloads page
document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
window.location.reload();
```

## Translation File Structure

### Main Translation File

`project/translations/en.json` contains all English translations as a flat JSON object:

```json
{
  "common_cancel": "Cancel",
  "common_save": "Save",
  "navigation_home": "Home",
  "generator_mortgage_title": "Hook Generator Generator",
  "account_profile_email_address": "Email Address"
}
```

### Adding New Translations

1. **Add key-value pair** to `translations/en.json`
2. **Use the key** in your component with `t("your_key")`
3. **For other languages**, add the same key with translated value to respective files (e.g., `es.json`, `fr.json`)

### Translation File Loading

Translations are loaded dynamically in the root layout:

```typescript
// app/layout.tsx
const locale = await getLocale(); // Get from cookie/header
const messages = await getMessages({ locale });

// Provide to app via NextIntlClientProvider
<NextIntlClientProvider messages={messages}>
  {children}
</NextIntlClientProvider>
```

## Automation Scripts

The project includes several helper scripts for managing translations:

### 1. `inject-translations.ts`

**Purpose**: Automatically replace hardcoded strings with translation keys

**Usage**:
```bash
# Dry run (preview changes)
bunx tsx scripts/inject-translations.ts --dry-run

# Apply changes
bunx tsx scripts/inject-translations.ts

# Process specific file
bunx tsx scripts/inject-translations.ts app/about/page.tsx
```

**What it does**:
- Scans `.tsx` and `.ts` files for hardcoded strings
- Matches strings against existing translation keys
- Replaces strings with `t('key')` calls
- Automatically adds `useTranslations` or `getTranslations` imports
- Generates a report in `translations/injection-report.txt`

**Features**:
- Skips technical strings (URLs, CSS classes, imports)
- Handles both client and server components
- Preserves JSX structure and formatting
- Detects already-translated code

### 2. `convert-translation-keys.ts`

**Purpose**: Convert dot-notation keys to underscore notation

**Usage**:
```bash
bunx tsx scripts/convert-translation-keys.ts
```

**What it does**:
- Converts keys like `"account.history"` → `"account_history"`
- Updates all translation files (en.json, es.json, etc.)

### 3. `update-translation-keys-in-code.ts`

**Purpose**: Update translation key references in code files

**Usage**:
```bash
bunx tsx scripts/update-translation-keys-in-code.ts
```

**What it does**:
- Finds all `t("key")` and `t('key')` patterns
- Replaces dots with underscores in keys
- Updates all TypeScript/TSX files

## Best Practices

### 1. Key Naming

- Use descriptive, hierarchical names: `{feature}_{component}_{element}`
- Keep keys concise but clear
- Group related keys with common prefix

### 2. Translation Content

- Keep translations concise and natural
- Use parameters for dynamic content
- Avoid hardcoding numbers, dates, or formatting

### 3. Component Organization

- Import translation hooks at the top
- Call hooks at the beginning of component
- Use `useMemo` for expensive translation operations if needed

### 4. Server vs Client Components

- Use `getTranslations` in server components (async)
- Use `useTranslations` in client components
- Don't mix them - check component type first

### 5. Testing Translations

- Test with different locales
- Verify parameter interpolation works
- Check for missing translation keys (will show key name if missing)

## Common Patterns

### Conditional Translations

```typescript
const t = useTranslations();
const message = isError 
  ? t("errors_generic") 
  : t("common_success");
```

### Pluralization

```typescript
// In translation file: "admin_contact_messages_count": "{count} {message} received"
const count = 5;
const message = count === 1 
  ? t("admin_contact_messages_message_singular")
  : t("admin_contact_messages_message_plural");
t("admin_contact_messages_count", { count, message });
```

### Form Validation

```typescript
const t = useTranslations();

if (!email) {
  errors.email = t("forms_required");
} else if (!isValidEmail(email)) {
  errors.email = t("forms_invalidEmail");
}
```

## Troubleshooting

### 404 Errors on All Pages (Navbar/Footer Work)

**Symptom:** Pages return 404 errors, but layout components (navbar, footer) render correctly. Server logs show `x-middleware-rewrite: /en`.

**Cause:** When using `localePrefix: "never"`, the `next-intl` middleware incorrectly tries to rewrite routes to locale-prefixed paths (e.g., `/` → `/en`), but your app structure doesn't have `app/[lang]/` directories.

**Solution:** **Remove** the `next-intl` middleware from `middleware.ts`. With `localePrefix: "never"`, locale detection should be handled purely in `app/layout.tsx` using `getLocale()`:

```typescript
// middleware.ts - DO NOT call intlMiddleware when using localePrefix: "never"
export async function middleware(request: NextRequest) {
  // Only security headers, CORS, etc.
  const response = NextResponse.next();
  applySecurityHeaders(response, request);
  return response;
}
```

The middleware should **only** handle security headers, CORS, and rate limiting. Locale detection is automatically handled by `next-intl` in the root layout.

**When to use middleware:** Only use `createIntlMiddleware` if you're using locale prefixes in URLs (`localePrefix: "as-needed"` or `"always"`) with `app/[lang]/` structure.

### Missing Translation Keys

If a translation key is missing, next-intl will display the key name instead of the translation. Check:

1. Key exists in `translations/en.json`
2. Key spelling matches exactly (case-sensitive)
3. Translation file is loaded correctly

### Locale Not Changing

If language switcher doesn't work:

1. Check cookie is being set: `document.cookie`
2. Verify middleware is running
3. Check browser console for errors
4. Ensure locale is in `locales` array in config

### Server/Client Mismatch

If you see hydration errors:

1. Ensure server components use `getTranslations`
2. Ensure client components use `useTranslations`
3. Don't use client hooks in server components

### Translation Not Updating

If translations don't update after changing locale:

1. Clear browser cache
2. Check cookie is set correctly
3. Verify page reloads after locale change
4. Check translation file is loaded for new locale

## Translation Status

See `TRANSLATION_STATUS_REPORT.md` for current translation coverage:

- ✅ **Fully Translated**: Public pages, auth, generators, account, checkout
- ⚠️ **Partially Translated**: Admin sub-components, FAQ data
- ❌ **Not Translated**: Some error states, PDF content

## Adding a New Language

1. **Add locale to config**:
   ```typescript
   // shared/i18n/config.ts
   export const locales = ["en", "es", "fr", "de", "pt", "it", "ja", "zh", "new-locale"] as const;
   ```

2. **Add metadata**:
   ```typescript
   export const localeMetadata = {
     // ... existing locales
     "new-locale": { name: "New Language", flag: "🏳️", nativeName: "New Language" },
   };
   ```

3. **Create translation file**:
   ```bash
   cp translations/en.json translations/new-locale.json
   ```

4. **Translate all keys** in `new-locale.json`

5. **Test** with language switcher

## Related Files

- **Configuration**: `project/shared/i18n/config.ts`
- **Middleware**: `project/middleware.ts`
- **Root Layout**: `project/app/layout.tsx`
- **Language Switcher**: `project/shared/components/language-switcher.tsx`
- **Translation Files**: `project/translations/*.json`
- **Scripts**: `project/scripts/inject-translations.ts`, `convert-translation-keys.ts`, `update-translation-keys-in-code.ts`
- **Status Report**: `TRANSLATION_STATUS_REPORT.md`

## Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [next-intl GitHub](https://github.com/next-intl/next-intl)

