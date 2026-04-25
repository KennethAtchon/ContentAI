"use client";

/**
 * Cookie Consent Banner
 *
 * Shown once to new visitors. Stores preference in localStorage.
 * Essential cookies are always allowed; analytics cookies are opt-in.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { useTranslation } from "react-i18next";

const COOKIE_CONSENT_KEY = "cookie_consent";

function getInitialVisibility(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    // localStorage unavailable (e.g. private browsing on some browsers)
    return false;
  }
}

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(getInitialVisibility);

  function saveConsent(value: "all" | "essential") {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("cookie_consent")}
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border-2 bg-background shadow-2xl">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex shrink-0 items-center justify-center h-12 w-12 rounded-xl bg-primary/10">
            <Cookie className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-base text-muted-foreground leading-relaxed">
              {t("cookies_consent_message")}{" "}
              <Link
                to="/cookies"
                className="text-primary underline hover:no-underline"
              >
                {t("cookies_learn_more")}
              </Link>
              .
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveConsent("essential")}
              className="flex-1 sm:flex-none"
            >
              {t("cookies_essential_only")}
            </Button>
            <Button
              size="sm"
              onClick={() => saveConsent("all")}
              className="flex-1 sm:flex-none"
            >
              {t("cookies_accept_all")}
            </Button>
          </div>

          <button
            aria-label={t("dismiss_cookie_banner")}
            onClick={() => saveConsent("essential")}
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground sm:static sm:right-auto sm:top-auto"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
