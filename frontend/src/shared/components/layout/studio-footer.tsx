/**
 * StudioFooter — Minimal dark-themed footer for marketing pages.
 */

import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/shared/constants/app.constants";

const FOOTER_LINKS = {
  product: [
    { href: "/features", labelKey: "navigation_features" },
    { href: "/pricing", labelKey: "metadata_pricing_title" },
    { href: "/faq", labelKey: "faq_metadata_title" },
  ],
  company: [
    { href: "/about", labelKey: "navigation_about" },
    { href: "/contact", labelKey: "shared_footer_contact" },
    { href: "/support", labelKey: "shared_footer_support" },
  ],
  legal: [
    { href: "/privacy", labelKey: "shared_footer_privacy" },
    { href: "/terms", labelKey: "shared_footer_terms" },
    { href: "/cookies", labelKey: "shared_footer_cookies" },
  ],
};

export function StudioFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-overlay-sm bg-studio-surface px-6 py-10 mt-8">
      <div className="max-w-[1000px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-gradient-to-br from-studio-accent to-studio-purple rounded-[7px] flex items-center justify-center text-[11px] shrink-0">
                ✦
              </div>
              <span className="text-[14px] font-bold text-primary tracking-[-0.3px]">
                {APP_NAME}
              </span>
            </div>
            <p className="text-[11px] text-dim-3 leading-[1.6]">
              AI-powered content intelligence for viral short-form video.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-[10px] font-semibold tracking-[1.5px] uppercase text-dim-3 mb-3">
              Product
            </p>
            <ul className="space-y-2">
              {FOOTER_LINKS.product.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-[12px] text-dim-2 hover:text-studio-accent transition-colors no-underline"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-[10px] font-semibold tracking-[1.5px] uppercase text-dim-3 mb-3">
              Company
            </p>
            <ul className="space-y-2">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-[12px] text-dim-2 hover:text-studio-accent transition-colors no-underline"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[10px] font-semibold tracking-[1.5px] uppercase text-dim-3 mb-3">
              Legal
            </p>
            <ul className="space-y-2">
              {FOOTER_LINKS.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-[12px] text-dim-2 hover:text-studio-accent transition-colors no-underline"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-5 border-t border-overlay-sm text-[10px] text-dim-3 text-center">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
