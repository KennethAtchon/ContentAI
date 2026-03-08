import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Eye, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { HeroSection } from "@/shared/components/layout/hero-section";
import { Section } from "@/shared/components/custom-ui/section";
import { useTranslation } from "react-i18next";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";

function AccessibilityPage() {
  const { t } = useTranslation();

  const measures = [
    t("accessibility_measure_1"),
    t("accessibility_measure_2"),
    t("accessibility_measure_3"),
    t("accessibility_measure_4"),
    t("accessibility_measure_5"),
    t("accessibility_measure_6"),
  ];

  const knownIssues = [t("accessibility_known_1"), t("accessibility_known_2")];

  return (
    <PageLayout variant="public">
      <HeroSection
        badge={{ icon: Eye, text: t("accessibility_badge") }}
        title={
          <>
            Accessibility
            <span className="block bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2">
              Statement
            </span>
          </>
        }
        description={t("metadata_accessibility_description")}
        showGradient
      >
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span>WCAG 2.1 AA Target</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <span>Keyboard Navigation</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span>Feedback Welcome</span>
          </div>
        </div>
      </HeroSection>

      <Section maxWidth="4xl">
        <Card className="border-2 shadow-lg">
          <CardContent className="p-8 md:p-12 space-y-8">
            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("accessibility_commitment_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("accessibility_commitment_text")}
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("accessibility_standard_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("accessibility_standard_text")}
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("accessibility_measures_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                {t("accessibility_measures_text")}
              </p>
              <ul className="space-y-2 text-muted-foreground">
                {measures.map((measure) => (
                  <li key={measure} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>{measure}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("accessibility_known_issues_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                {t("accessibility_known_issues_text")}
              </p>
              <ul className="space-y-2 text-muted-foreground">
                {knownIssues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">
                {t("accessibility_feedback_title")}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-2">
                {t("accessibility_feedback_text")}
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-primary hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p className="mt-2 text-muted-foreground">
                {t("accessibility_response_time")}
              </p>
            </section>

            <section className="rounded-xl border bg-muted/40 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {t("accessibility_last_reviewed")}
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      </Section>
    </PageLayout>
  );
}

export const Route = createFileRoute("/(public)/accessibility")({
  component: AccessibilityPage,
});
