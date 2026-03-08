"use client";

import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";

// Theme configuration constants
const THEME_ATTRIBUTE = "class";
const DEFAULT_THEME = "light";
const FORCED_THEME = "light";
const ENABLE_SYSTEM_THEME = false;

/**
 * Props for the ThemeProviderWrapper component.
 */
interface ThemeProviderWrapperProps {
  /** Child components to wrap with theme context */
  children: ReactNode;
}

/**
 * Wrapper component for next-themes ThemeProvider with application-specific configuration.
 * Currently configured to force light theme across the application.
 *
 * @param children - Child components that will have access to theme context
 * @returns Themed provider wrapper
 */
export default function ThemeProviderWrapper({
  children,
}: ThemeProviderWrapperProps) {
  return (
    <ThemeProvider
      attribute={THEME_ATTRIBUTE}
      defaultTheme={DEFAULT_THEME}
      forcedTheme={FORCED_THEME}
      enableSystem={ENABLE_SYSTEM_THEME}
    >
      {children}
    </ThemeProvider>
  );
}
