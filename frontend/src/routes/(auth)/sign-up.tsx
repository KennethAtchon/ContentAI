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
import {
  Eye,
  EyeOff,
  ArrowLeft,
  UserPlus,
  Sparkles,
  Loader2,
} from "lucide-react";
import { debugLog } from "@/shared/utils/debug";
import { useTranslation } from "react-i18next";
import { getAuthErrorMessage } from "@/shared/utils/error-handling/auth-error-handler";
import {
  useSmartRedirect,
  REDIRECT_PATHS,
} from "@/shared/utils/redirect/redirect-util";

const MIN_PASSWORD_LENGTH = 6;

function SignUpPage() {
  const { t } = useTranslation();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const { signUp, signInWithGoogle, user, authLoading } = useApp();
  const { smartRedirect } = useSmartRedirect();
  const search = useSearch({ from: "/(auth)/sign-up" });
  const redirectUrl = (search as Record<string, string | undefined>)
    .redirect_url;

  const validatePassword = (
    passwordValue: string,
    confirmPasswordValue: string
  ): string | null => {
    if (passwordValue !== confirmPasswordValue) {
      return t("auth_passwords_do_not_match");
    }

    if (passwordValue.length < MIN_PASSWORD_LENGTH) {
      return t("auth_password_min_length", { min: MIN_PASSWORD_LENGTH });
    }

    return null;
  };

  useEffect(() => {
    if (!authLoading && user) {
      // Use smart redirect to determine the best destination for new users
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;

      smartRedirect({
        intendedDestination: destination,
        isNewUser: true, // This is a new user who just signed up
      });
    }
  }, [user, authLoading, redirectUrl, smartRedirect]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const passwordError = validatePassword(password, confirmPassword);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      await signUp(email, password, name);
      // Use smart redirect after successful sign-up
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;

      smartRedirect({
        intendedDestination: destination,
        isNewUser: true,
      });
    } catch (submitError: unknown) {
      const errorMessage = getAuthErrorMessage(submitError, t);
      debugLog.error(
        t("common_signup_failed"),
        {
          service: "auth",
          operation: "signUp",
        },
        submitError
      );
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError("");

    try {
      await signInWithGoogle();
      // Use smart redirect after successful Google sign-up
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;

      smartRedirect({
        intendedDestination: destination,
        isNewUser: true,
      });
    } catch (submitError: unknown) {
      const errorMessage =
        submitError instanceof Error
          ? submitError.message
          : t("auth_sign_up_google_failed");
      debugLog.error(
        t("common_google_signup_failed"),
        {
          service: "auth",
          operation: "signInWithGoogle",
        },
        submitError
      );
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
          <div className="flex items-center justify-center">
            <Button variant="ghost" asChild>
              <Link to="/" className="text-sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("common_back_to_home")}
              </Link>
            </Button>
          </div>

          <Card className="border-2 shadow-lg">
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold">
                {t("common_create_an_account")}
              </CardTitle>
              <CardDescription className="text-base">
                {t("auth_sign_up_description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    {t("account_profile_full_name")}
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder={t("account_profile_enter_full_name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

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
                      placeholder={t("auth_create_password", {
                        min: MIN_PASSWORD_LENGTH,
                      })}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={MIN_PASSWORD_LENGTH}
                      className="h-11 pr-10"
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

                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-sm font-medium"
                  >
                    {t("common_confirm_password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t("auth_confirm_password_placeholder")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
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
                >
                  {loading
                    ? t("common_creating_account")
                    : t("auth_create_account_button")}
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
                onClick={handleGoogleSignUp}
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
                  {t("auth_have_account")}{" "}
                </span>
                <Link
                  to={REDIRECT_PATHS.SIGN_IN}
                  className="text-primary hover:underline font-medium"
                >
                  {t("navigation_signIn")}
                </Link>
              </div>
            </CardContent>
          </Card>

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

export const Route = createFileRoute("/(auth)/sign-up")({
  component: SignUpPage,
});
