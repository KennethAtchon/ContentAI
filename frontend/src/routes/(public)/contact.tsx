import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { HeroSection } from "@/shared/components/layout/hero-section";
import { Section } from "@/shared/components/custom-ui/section";
import { FeatureCard } from "@/shared/components/custom-ui/feature-card";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";
import {
  Mail,
  Phone,
  MessageSquare,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import ContactPageClient from "@/features/contact/components/contact-page-client";
import { useTranslation } from "react-i18next";

function ContactPage() {
  const { t } = useTranslation();

  return (
    <PageLayout variant="public">
      <HeroSection
        badge={{ icon: MessageSquare, text: t("contact_badge") }}
        title={t("common_get_in_touch")}
        description={t("contact_description")}
      />

      <Section maxWidth="6xl">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  {t("common_send_us_a_message")}
                </CardTitle>
                <CardDescription>
                  {t("contact_form_description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactPageClient />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 bg-gradient-to-br from-primary/5 to-purple-500/5">
              <CardHeader>
                <CardTitle className="text-xl">
                  {t("account_profile_contact_information")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FeatureCard
                  icon={Mail}
                  title={t("admin_settings_placeholder_email")}
                  description={t("shared_footer_contact_email")}
                >
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
                  >
                    {t("contact_send_email")}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </FeatureCard>

                <FeatureCard
                  icon={Phone}
                  title={t("admin_contact_messages_phone")}
                  description={t("account_profile_placeholder_phone")}
                >
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("common_mon_fri_9am_5pm_est")}
                  </p>
                </FeatureCard>

                <FeatureCard
                  icon={HelpCircle}
                  title={t("metadata_support_title")}
                  description={t("contact_support_description")}
                >
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("contact_support_priority")}
                  </p>
                </FeatureCard>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("payment_cancel_need_help")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href="/faq"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  {t("common_visit_our_faq_page")}
                </a>
                <a
                  href="/pricing"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  {t("contact_view_pricing")}
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}

export const Route = createFileRoute("/(public)/contact")({
  component: ContactPage,
});
