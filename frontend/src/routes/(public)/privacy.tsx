import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/shared/ui/primitives/card";
import { Shield, Lock, Eye, CheckCircle2 } from "lucide-react";
import { StudioShell } from "@/shared/ui/layout/studio-shell";
import { StudioHero } from "@/shared/ui/layout/studio-hero";
import { StudioSection } from "@/shared/ui/layout/studio-section";
import { useTranslation } from "react-i18next";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";

function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: Shield, text: t("account_profile_privacy_security") }}
        title={
          <>
            Privacy
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              Policy
            </span>
          </>
        }
        description={t(
          "common_your_privacy_is_important_to_us_learn_how_we_protect_and_han"
        )}
        showGradient
      >
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-base text-dim-2">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-studio-accent" />
            <span>{t("privacy_secure_data")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-studio-accent" />
            <span>{t("privacy_protected_information")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-studio-accent" />
            <span>{t("privacy_transparent_practices")}</span>
          </div>
        </div>
      </StudioHero>

      <StudioSection maxWidth="4xl">
        <Card className="bg-overlay-xs border border-overlay-sm rounded-[14px]">
          <CardContent className="p-8 md:p-12 space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("privacy_introduction")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("privacy_introduction_text")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("common_information_we_collect")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed mb-4">
                {t("privacy_information_collect_text")}
              </p>
              <ul className="space-y-2 text-dim-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("privacy_account_info")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("common_payment_and_billing_information")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("privacy_usage_data")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("common_device_and_browser_information")}</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("common_how_we_use_your_information")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t(
                  "common_your_information_is_used_to_provide_and_improve_our_services"
                )}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("privacy_data_security")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("privacy_data_security_text")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("privacy_your_rights")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed mb-4">
                {t(
                  "common_you_have_the_right_to_access_correct_or_delete_your_personal"
                )}
              </p>
              <ul className="space-y-2 text-dim-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("common_access_your_personal_data")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("common_request_data_correction_or_deletion")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("common_opt_out_of_marketing_communications")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("common_export_your_data")}</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("contact_metadata_title")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("privacy_contact_text")}{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-studio-accent hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/(public)/privacy")({
  component: PrivacyPage,
});
