import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioHero } from "@/shared/components/layout/studio-hero";
import { StudioSection } from "@/shared/components/custom-ui/studio-section";
import { StudioFeatureCard } from "@/shared/components/custom-ui/studio-feature-card";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";
import {
  Mail,
  Phone,
  MessageSquare,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";

function ContactPageClient() {
  return null;
}

function ContactPage() {
  const { t } = useTranslation();

  return (
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: MessageSquare, text: t("contact_badge") }}
        title={t("common_get_in_touch")}
        description={t("contact_description")}
      />

      <StudioSection maxWidth="6xl">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-overlay-xs border border-overlay-sm rounded-[14px] p-6">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-studio-accent" />
                <h2 className="text-lg font-bold text-studio-fg">
                  {t("common_send_us_a_message")}
                </h2>
              </div>
              <p className="text-sm text-dim-2 mb-5">
                {t("contact_form_description")}
              </p>
              <ContactPageClient />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Contact Info Card */}
            <div className="bg-overlay-xs border border-overlay-sm rounded-[14px] p-5">
              <h3 className="text-base font-bold text-studio-fg mb-4">
                {t("account_profile_contact_information")}
              </h3>
              <div className="space-y-4">
                <StudioFeatureCard
                  icon={Mail}
                  title={t("admin_settings_placeholder_email")}
                  description={t("shared_footer_contact_email")}
                >
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-sm text-studio-accent hover:underline flex items-center gap-1 mt-2 no-underline"
                  >
                    {t("contact_send_email")} <ArrowRight className="h-3 w-3" />
                  </a>
                </StudioFeatureCard>
                <StudioFeatureCard
                  icon={Phone}
                  title={t("admin_contact_messages_phone")}
                  description={t("account_profile_placeholder_phone")}
                >
                  <p className="text-sm text-dim-3 mt-2">
                    {t("common_mon_fri_9am_5pm_est")}
                  </p>
                </StudioFeatureCard>
                <StudioFeatureCard
                  icon={HelpCircle}
                  title={t("metadata_support_title")}
                  description={t("contact_support_description")}
                >
                  <p className="text-sm text-dim-3 mt-2">
                    {t("contact_support_priority")}
                  </p>
                </StudioFeatureCard>
              </div>
            </div>

            {/* Help Links */}
            <div className="bg-overlay-xs border border-overlay-sm rounded-[14px] p-5">
              <h3 className="text-base font-bold text-studio-fg mb-3">
                {t("payment_cancel_need_help")}
              </h3>
              <div className="space-y-2">
                <a
                  href="/faq"
                  className="flex items-center gap-2 text-sm text-dim-2 hover:text-studio-accent transition-colors no-underline"
                >
                  <ArrowRight className="h-3.5 w-3.5" />{" "}
                  {t("common_visit_our_faq_page")}
                </a>
                <a
                  href="/pricing"
                  className="flex items-center gap-2 text-sm text-dim-2 hover:text-studio-accent transition-colors no-underline"
                >
                  <ArrowRight className="h-3.5 w-3.5" />{" "}
                  {t("contact_view_pricing")}
                </a>
              </div>
            </div>
          </div>
        </div>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/(public)/contact")({
  component: ContactPage,
});
