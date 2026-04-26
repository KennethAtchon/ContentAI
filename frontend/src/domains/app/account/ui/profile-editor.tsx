/**
 * Profile Editor - Modern SaaS Design
 *
 * Modern profile editing component with improved UX and SaaS styling.
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProfile } from "@/app/state/profile-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { Button } from "@/shared/ui/primitives/button";
import { Input } from "@/shared/ui/primitives/input";
import { Label } from "@/shared/ui/primitives/label";
import { Textarea } from "@/shared/ui/primitives/textarea";
import {
  User,
  Phone,
  MapPin,
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { debugLog } from "@/shared/debug";
import { Badge } from "@/shared/ui/primitives/badge";
import { Alert, AlertDescription } from "@/shared/ui/primitives/alert";
import { ErrorAlert } from "@/shared/ui/feedback/error-alert";

const COMPONENT_NAME = "ProfileEditor";

export function ProfileEditor() {
  const { t } = useTranslation();
  const {
    profile,
    profileLoading,
    profileError,
    isOAuthUser,
    updateProfile,
    refreshProfile,
  } = useProfile();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        address: profile.address || "",
      });
    }
  }, [profile]);

  // Keep local error state aligned with profile query errors.
  useEffect(() => {
    if (profileError) {
      setError(profileError);
    } else {
      setError("");
    }
  }, [profileError]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
    setError("");
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const updates: Partial<typeof profile> = {
        name: formData.name,
        phone: formData.phone || null,
        address: formData.address || null,
      };

      // Only include email if not OAuth user
      if (!isOAuthUser) {
        updates.email = formData.email;
      }

      await updateProfile(updates);

      setSuccess(true);
      toast.success(t("account_profile_updated_successfully"));

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("errors_generic");
      debugLog.error(
        "Failed to update profile",
        { component: COMPONENT_NAME },
        err
      );
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (!profile) return false;
    return (
      formData.name !== (profile.name || "") ||
      (!isOAuthUser && formData.email !== (profile.email || "")) ||
      formData.phone !== (profile.phone || "") ||
      formData.address !== (profile.address || "")
    );
  };

  if (profileLoading) {
    return (
      <Card className="border-2">
        <CardContent className="py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-base text-muted-foreground">
            {t("account_profile_loading")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error && !profile) {
    return (
      <Card className="border-2">
        <CardContent className="py-12 text-center">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => refreshProfile()}>
            {t("shared_error_boundary_try_again")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-2 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                {t("account_profile_settings")}
              </CardTitle>
              <CardDescription className="mt-2">
                {t("common_manage_your_account_information_and_preferences")}
              </CardDescription>
            </div>
            {isOAuthUser && (
              <Badge variant="secondary">
                {t("account_profile_oauth_account")}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Main Form Card */}
      <Card className="border-2">
        <CardContent className="p-6 space-y-8">
          {success && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 font-medium">
                {t("account_profile_updated_successfully")}
              </AlertDescription>
            </Alert>
          )}

          <ErrorAlert error={error} />

          {/* Basic Information Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-1 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                {t("account_profile_basic_information")}
              </h3>
              <p className="text-base text-muted-foreground mb-4">
                {t("common_your_primary_account_details")}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-medium">
                  {t("account_profile_full_name")}
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder={t("account_profile_enter_full_name")}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium">
                  {t("account_profile_email_address")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder={t("account_profile_enter_email")}
                  disabled={isOAuthUser}
                  className="h-11"
                />
                <p className="text-sm text-muted-foreground">
                  {isOAuthUser
                    ? t("account_profile_oauth_email_note")
                    : t("account_profile_email_change_note")}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-6 border-t pt-6">
            <div>
              <h3 className="text-xl font-semibold mb-1 flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                {t("account_profile_contact_information")}
              </h3>
              <p className="text-base text-muted-foreground mb-4">
                {t("account_profile_how_to_reach")}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-base font-medium">
                  {t("account_profile_phone_number")}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder={t("account_profile_placeholder_phone")}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="address"
                  className="text-base font-medium flex items-center gap-2"
                >
                  <MapPin className="h-3 w-3" />
                  {t("account_profile_address")}
                </Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder={t("common_enter_your_full_address")}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-6">
            <div className="text-base text-muted-foreground">
              {profile && (
                <span>
                  {t("account_profile_last_updated")}{" "}
                  {profile.updatedAt
                    ? new Date(profile.updatedAt).toLocaleDateString()
                    : "N/A"}
                </span>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges()}
              className="min-w-[140px] h-11 font-semibold shadow-sm hover:shadow-md transition-all"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common_loading")}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t("common_save")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Notice Card */}
      <Card className="border-2 bg-muted/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2">
                {t("account_profile_privacy_security")}
              </h4>
              <ul className="text-base text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    {t(
                      "common_your_personal_information_is_encrypted_and_secure"
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    {t(
                      "common_information_is_only_shared_with_authorized_personnel"
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{t("account_profile_update_delete")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    {t("common_we_comply_with_all_privacy_regulations")}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
