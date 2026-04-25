import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useApp } from "@/app/state/app-context";
import { Link, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff, UserPlus, Sparkles } from "lucide-react";
import { debugLog } from "@/shared/debug";
import { useTranslation } from "react-i18next";
import { getAuthErrorMessage } from "@/shared/errors/auth-error-handler";
import {
  useSmartRedirect,
  REDIRECT_PATHS,
} from "@/shared/navigation/redirect-util";
import { toast } from "sonner";
import { IS_DEVELOPMENT } from "@/shared/config/envUtil";
import { StudioShell } from "@/app/layout/studio-shell";
import { cn } from "@/shared/lib/utils";
import { AuthRouteBoundary } from "@/shared/ui/layout/auth-route-boundary";

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

  const validatePassword = (pw: string, cpw: string): string | null => {
    if (pw !== cpw) return t("auth_passwords_do_not_match");
    if (pw.length < MIN_PASSWORD_LENGTH)
      return t("auth_password_min_length", { min: MIN_PASSWORD_LENGTH });
    return null;
  };

  useEffect(() => {
    if (!authLoading && user) {
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;
      smartRedirect({ intendedDestination: destination, isNewUser: true });
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
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;
      smartRedirect({ intendedDestination: destination, isNewUser: true });
    } catch (submitError: unknown) {
      const errorMessage = getAuthErrorMessage(submitError, t);
      debugLog.error(
        t("common_signup_failed"),
        { service: "auth", operation: "signUp" },
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
      const destination = redirectUrl
        ? decodeURIComponent(redirectUrl)
        : undefined;
      smartRedirect({ intendedDestination: destination, isNewUser: true });
    } catch (submitError: unknown) {
      setLoading(false);
      const errorMessage = IS_DEVELOPMENT
        ? submitError instanceof Error
          ? submitError.message
          : t("auth_sign_up_google_failed")
        : t("auth_sign_up_google_failed");
      toast.error(errorMessage);
      setError(errorMessage);
      debugLog.error(
        t("common_google_signup_failed"),
        { service: "auth", operation: "signInWithGoogle" },
        submitError
      );
      return;
    }
    setLoading(false);
  };

  if (authLoading || user) {
    return (
      <div className="h-screen bg-studio-bg flex items-center justify-center">
        <div className="studio-skeleton w-32 h-3" />
      </div>
    );
  }

  const inputCn = cn(
    "w-full h-11 bg-overlay-sm border border-overlay-md rounded-lg",
    "text-studio-fg text-base px-3 outline-none font-studio",
    "placeholder:text-dim-3 transition-colors",
    "focus:border-studio-ring/50 disabled:opacity-50"
  );

  return (
    <AuthRouteBoundary>
      <StudioShell variant="auth">
        <div className="flex-1 flex items-center justify-center px-4 py-12 min-h-[calc(100vh-48px)]">
          <div className="w-full max-w-md space-y-6">
            <div className="bg-overlay-xs border border-overlay-sm rounded-[14px] overflow-hidden">
              {/* Header */}
              <div className="p-6 pb-2 space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-studio-accent/15">
                  <UserPlus className="h-6 w-6 text-studio-accent" />
                </div>
                <h1 className="text-2xl font-bold text-primary">
                  {t("common_create_an_account")}
                </h1>
                <p className="text-base text-dim-2">
                  {t("auth_sign_up_description")}
                </p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="name"
                      className="text-sm font-semibold text-dim-2"
                    >
                      {t("account_profile_full_name")}
                    </label>
                    <input
                      id="name"
                      type="text"
                      placeholder={t("account_profile_enter_full_name")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={loading}
                      className={inputCn}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="text-sm font-semibold text-dim-2"
                    >
                      {t("admin_settings_placeholder_email")}
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder={t("account_profile_enter_email")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className={inputCn}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="password"
                      className="text-sm font-semibold text-dim-2"
                    >
                      {t("common_password")}
                    </label>
                    <div className="relative">
                      <input
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
                        className={cn(inputCn, "pr-10")}
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-0 h-full px-3 bg-transparent border-0 text-dim-2 hover:text-studio-fg cursor-pointer"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="confirmPassword"
                      className="text-sm font-semibold text-dim-2"
                    >
                      {t("common_confirm_password")}
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder={t("auth_confirm_password_placeholder")}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                        className={cn(inputCn, "pr-10")}
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-0 h-full px-3 bg-transparent border-0 text-dim-2 hover:text-studio-fg cursor-pointer"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-error/[0.08] border border-error/20 rounded-lg px-3 py-2.5">
                      <p className="text-sm font-medium text-error">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "w-full h-11 bg-gradient-to-br from-studio-accent to-studio-purple",
                      "text-white text-base font-bold rounded-lg border-0 cursor-pointer",
                      "transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed font-studio"
                    )}
                  >
                    {loading
                      ? t("common_creating_account")
                      : t("auth_create_account_button")}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-overlay-sm" />
                  </div>
                  <div className="relative flex justify-center text-sm uppercase tracking-[1px]">
                    <span className="bg-studio-surface px-3 text-dim-3">
                      {t("common_or_continue_with")}
                    </span>
                  </div>
                </div>

                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={loading}
                  className={cn(
                    "w-full h-11 bg-overlay-sm border border-overlay-md",
                    "text-dim-1 text-base font-medium rounded-lg",
                    "cursor-pointer transition-all hover:bg-overlay-md hover:text-studio-fg",
                    "disabled:opacity-50 disabled:cursor-not-allowed font-studio flex items-center justify-center gap-2"
                  )}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                </button>

                {/* Sign in link */}
                <div className="text-center text-sm pt-1">
                  <span className="text-dim-3">{t("auth_have_account")} </span>
                  <Link
                    to={REDIRECT_PATHS.SIGN_IN}
                    className="text-studio-accent hover:underline font-semibold no-underline"
                  >
                    {t("navigation_signIn")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-6 text-sm text-dim-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-studio-accent" />
                <span>{t("common_14_day_free_trial")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-studio-accent" />
                <span>{t("common_no_credit_card_required")}</span>
              </div>
            </div>
          </div>
        </div>
      </StudioShell>
    </AuthRouteBoundary>
  );
}

export const Route = createFileRoute("/(auth)/sign-up")({
  component: SignUpPage,
});
