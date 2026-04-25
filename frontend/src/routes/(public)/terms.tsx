import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/shared/ui/primitives/card";
import { FileText, Scale, AlertTriangle, CheckCircle2 } from "lucide-react";
import { StudioShell } from "@/shared/ui/layout/studio-shell";
import { StudioHero } from "@/shared/ui/layout/studio-hero";
import { StudioSection } from "@/shared/ui/layout/studio-section";
import { useTranslation } from "react-i18next";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";

function TermsPage() {
  const { t } = useTranslation();

  return (
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: Scale, text: t("terms_badge") }}
        title={
          <>
            Terms of
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              Service
            </span>
          </>
        }
        description={t(
          "common_please_read_these_terms_carefully_before_using_our_services"
        )}
        showGradient
      >
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-base text-dim-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-studio-accent" />
            <span>{t("common_legal_agreement")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-studio-accent" />
            <span>{t("common_fair_terms")}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-studio-accent" />
            <span>{t("common_important_disclaimers")}</span>
          </div>
        </div>
      </StudioHero>

      <StudioSection maxWidth="4xl">
        <Card className="bg-overlay-xs border border-overlay-sm rounded-[14px]">
          <CardContent className="p-8 md:p-12 space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("common_acceptance_of_terms")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("terms_acceptance_text")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("common_use_of_services")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t(
                  "common_you_agree_to_use_our_services_only_for_lawful_purposes_and_i"
                )}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("common_user_accounts")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("terms_user_accounts_text")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("terms_subscription")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed mb-4">
                {t("terms_subscription_text")}
              </p>
              <ul className="space-y-2 text-dim-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("terms_subscription_trial")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("terms_subscription_cancel")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("common_14_day_money_back_guarantee")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 flex-shrink-0" />
                  <span>{t("terms_subscription_access")}</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("common_intellectual_property")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t(
                  "common_all_content_and_materials_provided_through_reelstudio_services"
                )}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("common_limitation_of_liability")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("terms_limitation_text")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("contact_metadata_title")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("terms_contact_text")}{" "}
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

export const Route = createFileRoute("/(public)/terms")({
  component: TermsPage,
});
