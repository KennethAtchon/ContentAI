import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/shared/providers/theme-provider";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "react-i18next";

const nextTheme: Record<string, "light" | "dark" | "system"> = {
  dark: "light",
  light: "system",
  system: "dark",
};

const themeIcons = {
  dark: <Moon className="h-4 w-4" />,
  light: <Sun className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme[theme])}
      aria-label={t("theme_toggle")}
    >
      {themeIcons[theme]}
    </Button>
  );
}
