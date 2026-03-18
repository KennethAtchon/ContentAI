"use client";

import { useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApp } from "@/shared/contexts/app-context";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { debugLog } from "@/shared/utils/debug";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Shield, Lock, ArrowLeft } from "lucide-react";

/**
 * Admin verification page - shown when users navigate to admin routes without admin privileges
 */
export default function AdminVerifyPage() {
  const { t } = useTranslation();
  const [adminCode, setAdminCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  // Get the intended destination from the search params or default to admin dashboard
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = searchParams.get("redirect") || "/admin/dashboard";

  /**
   * Handles admin code submission and verification
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !adminCode.trim()) {
      setError(t("admin_verify_please_enter_code"));
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      // Verify admin code and set role
      const result = await authenticatedFetchJson<{
        success: boolean;
        error?: string;
      }>("/api/admin/verify", {
        method: "POST",
        body: JSON.stringify({ adminCode: adminCode.trim() }),
      });

      if (result.success) {
        debugLog.info("Admin verification successful", {
          service: "admin-verify",
          userId: user.uid,
        });

        // Force token refresh to get new claims
        await user.getIdToken(true);

        // Wait for claims to propagate and verify they're set
        let attempts = 0;
        const maxAttempts = 5;
        let claimsUpdated = false;

        while (attempts < maxAttempts && !claimsUpdated) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms
          const idTokenResult = await user.getIdTokenResult(true);
          claimsUpdated = idTokenResult.claims.role === "admin";
          attempts++;

          debugLog.info("Checking admin claims propagation", {
            service: "admin-verify",
            userId: user.uid,
            attempt: attempts,
            hasAdminClaim: claimsUpdated,
          });
        }

        if (!claimsUpdated) {
          debugLog.warn(
            "Admin claims failed to propagate after multiple attempts",
            {
              service: "admin-verify",
              userId: user.uid,
              attempts,
            }
          );
          setError(t("admin_verify_error_verifying"));
          return;
        }

        // Navigate to intended destination
        navigate({ to: redirectTo });
      } else {
        setError(result.error || t("admin_verify_invalid_code"));
      }
    } catch (error) {
      debugLog.error(
        "Error verifying admin code",
        {
          service: "admin-verify",
          userId: user.uid,
        },
        error
      );
      setError(t("admin_verify_error_verifying"));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoBack = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-studio-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={handleGoBack}
          className="mb-6 text-dim-2 hover:text-studio-fg"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common_go_back")}
        </Button>

        <Card className="border-overlay-sm bg-studio-surface">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-studio-accent/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-studio-accent" />
            </div>
            <CardTitle className="text-white text-xl">
              {t("admin_verify_title")}
            </CardTitle>
            <CardDescription className="text-dim-2">
              {t("admin_verify_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder={t("admin_verify_code_placeholder")}
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  className="bg-studio-surface border-overlay-md text-white placeholder:text-dim-3"
                  disabled={isVerifying}
                  autoFocus
                />
              </div>

              {error && (
                <Alert
                  variant="destructive"
                  className="bg-error/10 border-error/20"
                >
                  <Lock className="h-4 w-4" />
                  <AlertDescription className="text-error">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full bg-studio-accent hover:bg-studio-accent/90 text-white"
                disabled={isVerifying || !adminCode.trim()}
              >
                {isVerifying
                  ? t("admin_verify_verifying")
                  : t("admin_verify_access_button")}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-dim-2">
                {t("admin_verify_footer_note")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
