import { useEffect } from "react";
import { initializeAuthStore } from "./auth-store";
import { applyThemeToDocument, useThemeStore } from "./theme-store";

export function AppBootstrap() {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    initializeAuthStore();
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme);

    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeToDocument("system");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return null;
}
