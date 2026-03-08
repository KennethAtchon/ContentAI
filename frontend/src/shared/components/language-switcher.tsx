"use client";

import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { localeMetadata, type Locale } from "@/shared/i18n/config";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const [_isPending] = useTransition();

  const handleLocaleChange = (newLocale: string) => {
    // Change language using i18next
    i18n.changeLanguage(newLocale);

    // Store preference in localStorage
    localStorage.setItem("i18nextLng", newLocale);
  };

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(localeMetadata).map(([code, meta]) => (
          <SelectItem key={code} value={code}>
            <span className="flex items-center gap-2">
              <span>{meta.flag}</span>
              <span>{meta.nativeName}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
