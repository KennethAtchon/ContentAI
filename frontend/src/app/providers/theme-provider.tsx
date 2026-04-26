import { useThemeStore, type Theme } from "@/app/store/theme-store";
import { useShallow } from "zustand/react/shallow";

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export function useTheme(): ThemeProviderState {
  return useThemeStore(
    useShallow((state) => ({
      theme: state.theme,
      setTheme: state.setTheme,
    }))
  );
}
