"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/shared/contexts/app-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { debugLog } from "@/shared/utils/debug";
import { useTranslation } from "react-i18next";
import {
  APP_NAME,
  APP_DESCRIPTION,
  CORE_FEATURE_PATH,
} from "@/shared/constants/app.constants";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";

// Company tagline, contact info, and business hours are now translated
const ADMIN_VERIFY_ENDPOINT = "/api/admin/verify";
const ADMIN_DASHBOARD_ROUTE = "/admin/dashboard";

/**
 * Custom footer component with company information, navigation, and admin access.
 * Includes contact details, business hours, quick links, and admin verification modal.
 */
export default function FooterCustom() {
  const { t } = useTranslation();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const { user } = useApp();
  const navigate = useNavigate();
  const { authenticatedFetch, authenticatedFetchJson } =
    useAuthenticatedFetch();

  /**
   * Handles admin button click - checks existing admin access or prompts for authentication.
   */
  const handleAdminClick = async () => {
    if (user) {
      // Check if user already has admin role
      try {
        const response = await authenticatedFetch(ADMIN_VERIFY_ENDPOINT, {
          method: "GET",
        });

        if (response.ok) {
          // User already has admin access
          navigate({ to: ADMIN_DASHBOARD_ROUTE });
        } else {
          // User doesn't have admin access, show verification modal
          setIsAdminModalOpen(true);
        }
      } catch (error) {
        debugLog.error(
          "Error checking admin access",
          { service: "footer-custom", operation: "handleAdminClick" },
          error
        );
        // On error, show the modal as fallback
        setIsAdminModalOpen(true);
      }
    } else {
      // Redirect unauthenticated users to sign-in
      navigate({ to: REDIRECT_PATHS.SIGN_IN });
    }
  };

  /**
   * Handles admin code submission and verification.
   */
  const handleAdminCodeSubmit = async () => {
    if (!user || !adminCode.trim()) {
      alert(t("shared_footer_admin_please_enter_code"));
      return;
    }

    try {
      // Verify admin code and set role
      const result = await authenticatedFetchJson<{
        success: boolean;
        error?: string;
      }>(ADMIN_VERIFY_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ adminCode: adminCode.trim() }),
      });

      if (result.success) {
        setIsAdminModalOpen(false);
        setAdminCode("");
        // Force token refresh to get new claims
        await user.getIdToken(true);
        navigate({ to: ADMIN_DASHBOARD_ROUTE });
      } else {
        alert(result.error || t("shared_footer_admin_invalid_code"));
      }
    } catch (error) {
      debugLog.error(
        "Error verifying admin code",
        { service: "footer-custom", operation: "handleAdminCodeSubmit" },
        error
      );
      alert(t("shared_footer_admin_error_verifying"));
    }

    setAdminCode("");
  };

  return (
    <footer className="border-t bg-white">
      <div className="container py-8 md:py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="flex items-center gap-2">
              <Heart className="h-6 w-6 text-teal-600" />
              <span className="text-xl font-bold">{APP_NAME}</span>
            </div>
            <p className="mt-4 text-gray-700">
              {t("shared_footer_company_tagline")}
            </p>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-bold">
              {t("shared_footer_product")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/pricing"
                  className="text-gray-700 hover:text-teal-600"
                >
                  {t("metadata_pricing_title")}
                </Link>
              </li>
              <li>
                <Link
                  to={CORE_FEATURE_PATH}
                  className="text-gray-700 hover:text-teal-600"
                >
                  {t("shared_footer_studio")}
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-gray-700 hover:text-teal-600">
                  {t("faq_metadata_title")}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-gray-700 hover:text-teal-600"
                >
                  {t("shared_footer_contact")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-bold">
              {t("shared_footer_resources")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/features"
                  className="text-gray-700 hover:text-teal-600"
                >
                  {t("metadata_features_title")}
                </Link>
              </li>
              <li>
                <Link
                  to="/api-documentation"
                  className="text-gray-700 hover:text-teal-600"
                >
                  {t("metadata_api_documentation_title")}
                </Link>
              </li>
              <li>
                <Link
                  to="/support"
                  className="text-gray-700 hover:text-teal-600"
                >
                  {t("metadata_support_title")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-bold">
              {t("shared_footer_contact")}
            </h3>
            <address className="not-italic">
              <p className="mb-2 text-gray-700">
                {t("shared_footer_contact_street")}
              </p>
              <p className="mb-2 text-gray-700">
                {t("shared_footer_contact_city")}
              </p>
              <p className="mb-2 text-gray-700">
                <a
                  href={`tel:${t("shared_footer_contact_phone").replace(/\D/g, "")}`}
                  className="hover:text-teal-600"
                >
                  {t("shared_footer_contact_phone")}
                </a>
              </p>
              <p className="text-gray-700">
                <a
                  href={`mailto:${t("shared_footer_contact_email")}`}
                  className="hover:text-teal-600"
                >
                  {t("shared_footer_contact_email")}
                </a>
              </p>
            </address>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-bold">
              {t("shared_footer_hours")}
            </h3>
            <ul className="space-y-2 text-gray-700">
              <li>{t("shared_footer_business_hours")}</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-center text-gray-700 md:text-left">
            &copy; {new Date().getFullYear()}{" "}
            {t("shared_footer_copyright", {
              company: `${APP_NAME} - ${APP_DESCRIPTION}`,
            })}
          </p>
          <div className="flex gap-4">
            <Link to="/privacy" className="text-gray-700 hover:text-teal-600">
              {t("metadata_privacy_title")}
            </Link>
            <Link to="/terms" className="text-gray-700 hover:text-teal-600">
              {t("metadata_terms_title")}
            </Link>
            <Link to="/cookies" className="text-gray-700 hover:text-teal-600">
              {t("metadata_cookies_title")}
            </Link>
            <Link
              to="/accessibility"
              className="text-gray-700 hover:text-teal-600"
            >
              {t("metadata_accessibility_title")}
            </Link>
            <Button
              variant="outline"
              onClick={handleAdminClick}
              className="text-gray-700 hover:text-teal-600"
            >
              {t("shared_footer_admin")}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("shared_footer_admin_access")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t(
                "common_please_enter_the_admin_code_to_access_the_admin_dashboard"
              )}
            </p>
            <Input
              type="password"
              placeholder={t("shared_footer_admin_code_placeholder")}
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAdminCodeSubmit()}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsAdminModalOpen(false)}
              >
                {t("common_cancel")}
              </Button>
              <Button onClick={handleAdminCodeSubmit}>
                {t("shared_footer_admin_access_button")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
