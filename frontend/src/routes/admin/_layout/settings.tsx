import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useApp } from "@/shared/contexts/app-context";
import { debugLog } from "@/shared/utils/debug";
import { User, Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

export const Route = createFileRoute("/admin/_layout/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    role: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const {
    profile,
    profileLoading: fetching,
    profileError,
    updateProfile,
  } = useApp();

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        address: profile.address || "",
        role: profile.role || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
    if (profileError) {
      setMessage(profileError);
    }
  }, [profile, profileError]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setMessage("");
  }, []);

  const isFormValid = useMemo(() => {
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      return false;
    }
    return !!profile?.id;
  }, [form.newPassword, form.confirmPassword, profile]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage("");

      if (form.newPassword && form.newPassword !== form.confirmPassword) {
        setMessage(t("admin_new_password_and_confirm_password_do_not_match"));
        return;
      }

      if (!profile?.id) {
        setMessage(t("admin_user_profile_not_loaded_please_reload_the_page"));
        return;
      }

      setLoading(true);

      try {
        await updateProfile({
          name: form.name,
          phone: form.phone || null,
          address: form.address || null,
        });

        if (form.newPassword) {
          debugLog.warn(
            t("admin_password_update_not_yet_implemented_via_profile_en"),
            {
              service: "admin-settings",
              operation: "handleSubmit",
            }
          );
        }

        debugLog.info(t("admin_settings_updated_successfully"), {
          service: "admin-settings",
          operation: "handleSubmit",
          userId: profile.id,
          hasPasswordUpdate: !!form.newPassword,
        });
        setMessage(t("admin_settings_updated_successfully_1"));
        setForm((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));
      } catch (error) {
        const errorMessage = (error as Error).message;
        debugLog.error(
          t("admin_failed_to_update_settings"),
          {
            service: "admin-settings",
            operation: "handleSubmit",
            userId: profile.id,
          },
          error
        );
        setMessage(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [form, profile, updateProfile, t]
  );

  const userInfo = useMemo(
    () => ({
      name: form.name || t("common_unavailable"),
      email: form.email || t("common_unavailable"),
      phone: form.phone || t("common_unavailable"),
      address: form.address || t("common_unavailable"),
      role: form.role || t("common_unavailable"),
    }),
    [form, t]
  );

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Application settings and configuration
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Info Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Your Information
            </CardTitle>
            <CardDescription>
              {t("common_current_account_details")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-base font-medium text-muted-foreground">Name</p>
              <p className="text-lg font-semibold">
                {userInfo.name !== t("common_unavailable") ? (
                  userInfo.name
                ) : (
                  <span className="text-muted-foreground italic">
                    {userInfo.name}
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-muted-foreground">Email</p>
              <p className="text-lg font-semibold">
                {userInfo.email !== t("common_unavailable") ? (
                  userInfo.email
                ) : (
                  <span className="text-muted-foreground italic">
                    {userInfo.email}
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-muted-foreground">Phone</p>
              <p className="text-lg font-semibold">
                {userInfo.phone !== t("common_unavailable") ? (
                  userInfo.phone
                ) : (
                  <span className="text-muted-foreground italic">
                    {userInfo.phone}
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-muted-foreground">
                Address
              </p>
              <p className="text-lg font-semibold">
                {userInfo.address !== t("common_unavailable") ? (
                  userInfo.address
                ) : (
                  <span className="text-muted-foreground italic">
                    {userInfo.address}
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1 pt-2 border-t">
              <p className="text-base font-medium text-muted-foreground">Role</p>
              <p className="text-lg font-semibold">
                {userInfo.role !== t("common_unavailable") ? (
                  userInfo.role
                ) : (
                  <span className="text-muted-foreground italic">
                    {userInfo.role}
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Settings Form */}
        <Card className="lg:col-span-2 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Account Settings
            </CardTitle>
            <CardDescription>
              Update your profile information and password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder={t("admin_settings_placeholder_name")}
                    autoComplete="name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {t("account_profile_email_address")}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    value={form.email}
                    readOnly
                    disabled
                    placeholder={t("admin_settings_placeholder_email")}
                    autoComplete="email"
                    className="h-11 bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t("common_email_cannot_be_changed")}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common_phone_number")}</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder={t("admin_settings_placeholder_phone")}
                    autoComplete="tel"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">
                    {t("account_profile_address")}
                  </Label>
                  <Input
                    id="address"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder={t("admin_settings_placeholder_address")}
                    autoComplete="street-address"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-xl font-semibold">
                  {t("common_change_password")}
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">
                      {t("common_current_password")}
                    </Label>
                    <Input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      value={form.currentPassword}
                      onChange={handleChange}
                      placeholder={t(
                        "admin_settings_placeholder_current_password"
                      )}
                      autoComplete="current-password"
                      className="h-11"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">
                        {t("common_new_password")}
                      </Label>
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        value={form.newPassword}
                        onChange={handleChange}
                        placeholder={t(
                          "admin_settings_placeholder_new_password"
                        )}
                        autoComplete="new-password"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">
                        {t("common_confirm_new_password")}
                      </Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder={t(
                          "admin_settings_placeholder_confirm_password"
                        )}
                        autoComplete="new-password"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {message && (
                <Alert
                  variant={
                    message.includes("successfully") ? "default" : "destructive"
                  }
                  className="border-2"
                >
                  {message.includes("successfully") ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription className="font-medium">
                    {message}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading || !isFormValid}
                className="w-full h-11 font-semibold shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common_loading")}
                  </>
                ) : (
                  t("common_save")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
