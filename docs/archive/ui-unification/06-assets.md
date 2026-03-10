# Generated Assets

Visual assets for the UI unification to the studio dark theme. All files are in `frontend/public/assets/`.

## Assets

### 1. `reelstudio-logo.png`
- **Purpose**: App icon / favicon / topbar logo
- **Design**: Indigo-to-purple gradient four-pointed sparkle on dark background
- **Usage**: Replace existing `/logo.png` in the topbar, or use alongside the ✦ icon
- **Path**: `/assets/reelstudio-logo.png`

### 2. `hero-bg.png`
- **Purpose**: Background image for landing page hero section
- **Design**: Ultra-dark (#08080F) base with subtle indigo and purple radial glows, fine dot grid
- **Usage**: Apply as a background image on the hero section:
  ```css
  background-image: url('/assets/hero-bg.png');
  background-size: cover;
  background-position: center;
  ```
- **Path**: `/assets/hero-bg.png`

### 3. `og-image.png`
- **Purpose**: Open Graph / social media preview image for link sharing
- **Design**: Dark branded image with phone mockup, sparkle icon, "ReelStudio" text, and "AI-Powered Content Intelligence" tagline
- **Usage**: Add to `index.html` meta tags:
  ```html
  <meta property="og:image" content="/assets/og-image.png" />
  <meta name="twitter:image" content="/assets/og-image.png" />
  ```
- **Path**: `/assets/og-image.png`

## Color References

All assets use the studio palette:
- **Indigo Accent**: `#818CF8`
- **Purple Accent**: `#C084FC`
- **Background**: `#08080F`
- **Surface**: `#0C0C18`
