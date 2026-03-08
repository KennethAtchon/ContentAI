import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Cookie, Shield, Settings, CheckCircle2 } from "lucide-react";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { HeroSection } from "@/shared/components/layout/hero-section";
import { Section } from "@/shared/components/custom-ui/section";
import { useTranslation } from "react-i18next";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";

function CookiesPage() {
  const { t } = useTranslation();

  const cookieTypes = [
    {
      title: t("cookies_essential_title"),
      text: t("cookies_essential_text"),
      icon: Shield,
    },
    {
      title: t("cookies_functional_title"),
      text: t("cookies_functional_text"),
      icon: Settings,
    },
    {
      title: t("cookies_analytics_title"),
      text: t("cookies_analytics_text"),
      icon: Cookie,
    },
    {
      title: t("cookies_third_party_title"),
      text: t("cookies_third_party_text"),
      icon: Shield,
    },
  ];

  return (
    <PageLayout variant="public">
      <HeroSection
        badge={{ icon: Cookie, text: t("cookies_badge") }}
        title={
          <>
            Cookie
            <span className="block bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2">
              Policy
            </span>
          </>
        }
        description={t("metadata_cookies_description")}
        showGradient
      >
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span>{t("privacy_protected_information")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <span>{t("cookies_control_title")}</span>
          </div>
        </div>
      </HeroSection>

      <Section maxWidth="4xl">
        <Card className="border-2 shadow-lg">
          <CardContent className="p-8 md:p-12 space-y-8">
            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("cookies_what_are_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("cookies_what_are_text")}
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-6">
                {t("cookies_types_title")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {cookieTypes.map(({ title, text, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-xl border bg-card p-5 shadow-sm"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="mb-2 font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("cookies_control_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("cookies_control_text")}
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("cookies_changes_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("cookies_changes_text")}
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("contact_metadata_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("cookies_contact_text")}{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-primary hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>

            <section className="rounded-xl border bg-muted/40 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <strong>Last reviewed:</strong> February 21, 2026
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      </Section>
    </PageLayout>
  );
}

export const Route = createFileRoute("/(public)/cookies")({
  component: CookiesPage,
});
