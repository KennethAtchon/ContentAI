import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Cookie, Shield, Settings, CheckCircle2 } from "lucide-react";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioHero } from "@/shared/components/layout/studio-hero";
import { StudioSection } from "@/shared/components/layout/studio-section";
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
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: Cookie, text: t("cookies_badge") }}
        title={
          <>
            Cookie
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              Policy
            </span>
          </>
        }
        description={t("metadata_cookies_description")}
        showGradient
      >
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-base text-dim-2">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-studio-accent" />
            <span>{t("privacy_protected_information")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-studio-accent" />
            <span>{t("cookies_control_title")}</span>
          </div>
        </div>
      </StudioHero>

      <StudioSection maxWidth="4xl">
        <Card className="bg-overlay-xs border border-overlay-sm rounded-[14px]">
          <CardContent className="p-8 md:p-12 space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("cookies_what_are_title")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("cookies_what_are_text")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">
                {t("cookies_types_title")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {cookieTypes.map(({ title, text, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-xl border bg-card p-5 shadow-sm"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-studio-accent/15">
                      <Icon className="h-5 w-5 text-studio-accent" />
                    </div>
                    <h3 className="mb-2 font-semibold">{title}</h3>
                    <p className="text-base text-dim-2 leading-relaxed">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("cookies_control_title")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("cookies_control_text")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("cookies_changes_title")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("cookies_changes_text")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                {t("contact_metadata_title")}
              </h2>
              <p className="text-base text-dim-2 leading-relaxed">
                {t("cookies_contact_text")}{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-studio-accent hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>

            <section className="rounded-xl border bg-muted/40 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 shrink-0" />
                <p className="text-base text-dim-2">
                  <strong>Last reviewed:</strong> February 21, 2026
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/(public)/cookies")({
  component: CookiesPage,
});
