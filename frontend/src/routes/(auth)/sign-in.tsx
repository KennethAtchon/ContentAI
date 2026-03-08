/**
 * Sign In Page - Modern SaaS Design
 *
 * Modern sign-in page with email/password and Google OAuth support.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useApp } from "@/shared/contexts/app-context";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Link, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff, ArrowLeft, LogIn, Sparkles, Loader2 } from "lucide-react";
import { debugLog } from "@/shared/utils/debug";
import { useTranslation } from "react-i18next";
import { getAuthErrorMessage } from "@/shared/utils/error-handling/auth-error-handler";
import {
  useSmartRedirect,
  REDIRECT_PATHS as _REDIRECT_PATHS,
} from "@/shared/utils/redirect/redirect-util";
import { toast } from "sonner";
import { IS_DEVELOPMENT } from "@/shared/utils/config/envUtil";

const SIGN_UP_PATH = "/sign-up";

function SignInPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const search = useSearch({ from: "/(auth)/sign-in" });
  const redirectUrl = (search as any)?.redirect_url;

  const { signIn, signInWithGoogle, user, authLoading } = useApp();
  const { smartRedirect } = useSmartRedirect();

  // Redirect authenticated users away from sign-in page
  useEffect(() => {
    if (!authLoading && user) {
      // User is already authenticated, use smart redirect
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;

      smartRedirect({
        intendedDestination: destination,
        isNewUser: false, // This is a returning user
      });
    }
  }, [user, authLoading, redirectUrl, smartRedirect]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(email, password);
      // Use smart redirect after successful sign-in
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;

      smartRedirect({
        intendedDestination: destination,
        isNewUser: false,
      });
    } catch (error: unknown) {
      const errorMessage = getAuthErrorMessage(error, t);
      debugLog.error(
        t("common_signin_failed"),
        {
          service: "auth",
          operation: "signIn",
        },
        error
      );
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      await signInWithGoogle();
      // Use smart redirect after successful Google sign-in
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;

      smartRedirect({
        intendedDestination: destination,
        isNewUser: false,
      });
    } catch (error: unknown) {
      // Fast error handling - immediately show toast and stop loading
      setLoading(false);
      
      // Development: show actual error message, Production: show generic message
      const errorMessage = IS_DEVELOPMENT
        ? error instanceof Error
          ? error.message
          : t("auth_sign_in_google_failed")
        : t("auth_sign_in_google_failed");
      
      // Show toast error immediately for better UX
      toast.error(errorMessage);
      
      // Also set error state for the alert component (as backup)
      setError(errorMessage);
      
      debugLog.error(
        t("common_google_signin_failed"),
        {
          service: "auth",
          operation: "signInWithGoogle",
        },
        error
      );
      return; // Early return to avoid finally block setting loading to false again
    }
    
    // Only set loading to false if we didn't error
    setLoading(false);
  };

  // Show loading state while checking authentication or if user is authenticated (will redirect)
  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/20">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Back Link */}
          <div className="flex items-center justify-center">
            <Button variant="ghost" asChild>
              <Link to="/" className="text-sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("common_back_to_home")}
              </Link>
            </Button>
          </div>

          {/* Sign In Card */}
          <Card className="border-2 shadow-lg">
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <LogIn className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold">
                {t("common_welcome_back")}
              </CardTitle>
              <CardDescription className="text-base">
                {t(
                  "common_sign_in_to_your_calcpro_account_to_access_your_calculators"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                data-testid="sign-in-form"
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    {t("admin_settings_placeholder_email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("account_profile_enter_email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                    data-testid="email-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    {t("common_password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth_enter_password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11 pr-10"
                      data-testid="password-input"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="border-2">
                    <AlertDescription className="font-medium">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 font-semibold shadow-sm"
                  disabled={loading}
                  data-testid="sign-in-button"
                >
                  {loading ? t("common_signing_in") : t("navigation_signIn")}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("common_or_continue_with")}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-2"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {t("common_continue_with_google")}
              </Button>

              <div className="text-center text-sm pt-2">
                <span className="text-muted-foreground">
                  {t("auth_no_account")}{" "}
                </span>
                <Link
                  to={SIGN_UP_PATH}
                  className="text-primary hover:underline font-medium"
                >
                  {t("navigation_signUp")}
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>{t("common_14_day_free_trial")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>{t("common_no_credit_card_required")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/(auth)/sign-in")({
  component: SignInPage,
});
