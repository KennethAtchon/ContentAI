import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { HeroSection } from "@/shared/components/layout/hero-section";
import { Section } from "@/shared/components/custom-ui/section";
import { FeatureCard } from "@/shared/components/custom-ui/feature-card";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Calculator,
  TrendingUp,
  Shield,
  BarChart3,
  FileText,
  Download,
  Lock,
  Globe,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";

function FeaturesPage() {
  const { t } = useTranslation();

  const CALCULATOR_FEATURES = [
    {
      icon: Calculator,
      title: t("home_features_mortgage_title"),
      description: t("features_mortgage_description"),
      features: [
        t("features_mortgage_feature_1"),
        t("features_mortgage_feature_2"),
        t("features_mortgage_feature_3"),
        t("features_mortgage_feature_4"),
        t("features_mortgage_feature_5"),
      ],
      availableIn: ["basic", "pro", "enterprise"],
    },
    {
      icon: TrendingUp,
      title: t("home_features_loan_title"),
      description: t("features_loan_description"),
      features: [
        t("features_loan_feature_1"),
        t("features_loan_feature_2"),
        t("features_loan_feature_3"),
        t("features_loan_feature_4"),
        t("features_loan_feature_5"),
      ],
      availableIn: ["basic", "pro", "enterprise"],
    },
    {
      icon: BarChart3,
      title: t("home_features_investment_title"),
      description: t("features_investment_description"),
      features: [
        t("features_investment_feature_1"),
        t("features_investment_feature_2"),
        t("features_investment_feature_3"),
        t("features_investment_feature_4"),
        t("features_investment_feature_5"),
      ],
      availableIn: ["pro", "enterprise"],
    },
    {
      icon: Shield,
      title: t("home_features_retirement_title"),
      description: t("features_retirement_description"),
      features: [
        t("features_retirement_feature_1"),
        t("features_retirement_feature_2"),
        t("features_retirement_feature_3"),
        t("features_retirement_feature_4"),
        t("features_retirement_feature_5"),
      ],
      availableIn: ["pro", "enterprise"],
    },
  ];

  const PLATFORM_FEATURES = [
    {
      icon: Download,
      title: t("features_export_title"),
      description: t("features_export_description"),
      tiers: {
        basic: "PDF",
        pro: t("common_pdf_excel_csv"),
        enterprise: t("common_pdf_excel_csv_api"),
      },
    },
    {
      icon: Lock,
      title: t("home_benefits_secure_title"),
      description: t("features_secure_description"),
      tiers: {
        basic: t("features_tier_security_basic"),
        pro: t("features_tier_security_pro"),
        enterprise: t("features_tier_security_enterprise"),
      },
    },
    {
      icon: Globe,
      title: t("features_access_title"),
      description: t("features_access_description"),
      tiers: {
        basic: t("features_tier_access_basic"),
        pro: t("features_tier_access_pro"),
        enterprise: t("features_tier_access_enterprise"),
      },
    },
    {
      icon: FileText,
      title: t("features_history_title"),
      description: t("features_history_description"),
      tiers: {
        basic: t("features_tier_history_basic"),
        pro: t("features_tier_history_pro"),
        enterprise: t("features_tier_history_enterprise"),
      },
    },
  ];

  const USE_CASES = [
    {
      title: t("features_real_estate"),
      description: t("features_real_estate_description"),
      icon: Calculator,
    },
    {
      title: t("features_financial_advisors"),
      description: t("features_financial_advisors_description"),
      icon: TrendingUp,
    },
    {
      title: t("features_small_business"),
      description: t("features_small_business_description"),
      icon: BarChart3,
    },
    {
      title: t("features_personal_finance"),
      description: t("features_personal_finance_description"),
      icon: Shield,
    },
  ];

  const titleParts = t("features_title").split(" ");
  const titleFirst = titleParts.slice(0, 3).join(" ");
  const titleSecond = titleParts.slice(3).join(" ");

  return (
    <PageLayout variant="public">
      <HeroSection
        badge={{ icon: Sparkles, text: t("features_badge") }}
        title={
          <>
            {titleFirst}{" "}
            <span className="block bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2">
              {titleSecond}
            </span>
          </>
        }
        description={t("features_description")}
      />

      <Section>
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("features_calculator_types")}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("features_calculator_types_description")}
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {CALCULATOR_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="border-2 hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex gap-1">
                      {feature.availableIn.map((tier) => (
                        <Badge
                          key={tier}
                          variant="outline"
                          className="text-xs capitalize"
                        >
                          {tier}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <CardTitle className="text-2xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base mt-2">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section variant="muted" padding="default">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("common_platform_features")}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("features_platform_description")}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="border-2 hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="mt-2">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 pt-4 border-t">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">
                      {t("features_available_in")}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">
                          {t("subscription_basic")}:
                        </span>{" "}
                        {feature.tiers.basic}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">
                          {t("subscription_pro")}:
                        </span>{" "}
                        {feature.tiers.pro}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">
                          {t("subscription_enterprise")}:
                        </span>{" "}
                        {feature.tiers.enterprise}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("features_perfect_for")}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("features_perfect_for_description")}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((useCase, index) => {
            const Icon = useCase.icon;
            return (
              <FeatureCard
                key={index}
                icon={Icon}
                title={useCase.title}
                description={useCase.description}
                hoverable
              />
            );
          })}
        </div>
      </Section>

      <Section variant="gradient" maxWidth="2xl">
        <div className="text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("features_ready_to_start")}
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            {t("features_ready_description")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="saas-button">
              <Link to="/pricing">
                {t("common_view_pricing_plans")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="saas-button">
              <Link to="/sign-up">{t("home_hero_cta_start_trial")}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}

export const Route = createFileRoute("/(public)/features")({
  component: FeaturesPage,
});
