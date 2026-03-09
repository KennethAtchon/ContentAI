import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { HeroSection } from "@/shared/components/layout/hero-section";
import { Section } from "@/shared/components/custom-ui/section";
import { FeatureCard } from "@/shared/components/custom-ui/feature-card";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useTranslation } from "react-i18next";
import {
  Target,
  Users,
  Award,
  ArrowRight,
  Sparkles,
  Eye,
  Brain,
  TrendingUp,
  Shield,
} from "lucide-react";
import { APP_NAME } from "@/shared/constants/app.constants";

function AboutPage() {
  const { t } = useTranslation();

  const VALUES = [
    {
      icon: Target,
      title: t("about_accuracy_first"),
      description: t("about_accuracy_first_description"),
    },
    {
      icon: Shield,
      title: t("about_security_privacy"),
      description: t("about_security_privacy_description"),
    },
    {
      icon: TrendingUp,
      title: t("about_continuous_improvement"),
      description: t("about_continuous_improvement_description"),
    },
    {
      icon: Users,
      title: t("about_user_centric"),
      description: t("about_user_centric_description"),
    },
  ];

  const TEAM_HIGHLIGHTS = [
    {
      title: t("about_content_experts"),
      description: t("about_content_experts_description"),
    },
    {
      title: t("about_technology_leaders"),
      description: t("about_technology_leaders_description"),
    },
    {
      title: t("about_customer_focused"),
      description: t("about_customer_focused_description"),
    },
  ];

  return (
    <PageLayout variant="public">
      <HeroSection
        badge={{ icon: Sparkles, text: t("about_our_story") }}
        title={
          <>
            {t("navigation_about")}{" "}
            <span className="block bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2">
              {APP_NAME}
            </span>
          </>
        }
        description={t(
          "about_reelstudio_description"
        )}
      />

      <Section>
        <Card className="border-2 bg-gradient-to-br from-primary/5 to-purple-500/5">
          <CardContent className="p-8 md:p-12">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight">
              {t("common_our_mission")}
            </h2>
            <p className="mb-4 text-lg text-muted-foreground leading-relaxed">
              {t("about_mission_paragraph_1")}
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("about_mission_paragraph_2")}
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section variant="muted" padding="default">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("common_our_values")}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("common_the_principles_that_guide_everything_we_do")}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value, index) => {
            const Icon = value.icon;
            return (
              <FeatureCard
                key={index}
                icon={Icon}
                title={value.title}
                description={value.description}
                hoverable
              />
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("about_why_choose_reelstudio")}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("common_built_by_experts_trusted_by_professionals")}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {TEAM_HIGHLIGHTS.map((highlight, index) => (
            <FeatureCard
              key={index}
              icon={Award}
              title={highlight.title}
              description={highlight.description}
              hoverable
            />
          ))}
        </div>
      </Section>

      <Section variant="gradient" padding="default">
        <Card className="border-2">
          <CardContent className="p-8 md:p-12">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  {t("about_content_intelligence")}
                </h2>
                <p className="text-muted-foreground">
                  AI-powered insights from millions of viral reels
                </p>
              </div>
            </div>
            <div className="space-y-4 text-lg text-muted-foreground">
              <p>{t("about_content_intelligence_description_1")}</p>
              <p>{t("about_content_intelligence_description_2")}</p>
              <p>{t("about_content_intelligence_description_3")}</p>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section maxWidth="2xl">
        <div className="text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("about_ready_to_experience")}
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            {t("about_join_thousands")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="saas-button">
              <Link to="/pricing">
                {t("common_view_pricing_plans")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="saas-button">
              <Link to="/contact">{t("contact_metadata_title")}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}

export const Route = createFileRoute("/(public)/about")({
  component: AboutPage,
});
