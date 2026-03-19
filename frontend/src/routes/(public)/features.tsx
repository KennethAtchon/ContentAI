import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioHero } from "@/shared/components/layout/studio-hero";
import { StudioSection } from "@/shared/components/custom-ui/studio-section";
import { StudioFeatureCard } from "@/shared/components/custom-ui/studio-feature-card";
import { useTranslation } from "react-i18next";
import {
  Search,
  Brain,
  Sparkles,
  Calendar,
  Download,
  Lock,
  Globe,
  ArrowRight,
  CheckCircle2,
  Eye,
  TrendingUp,
  FileText,
} from "lucide-react";

function FeaturesPage() {
  const { t } = useTranslation();

  const STUDIO_FEATURES = [
    {
      icon: Search,
      title: t("studio_features_discover_title"),
      description: t("studio_features_discover_description"),
      features: [
        t("studio_features_discover_feature_1"),
        t("studio_features_discover_feature_2"),
        t("studio_features_discover_feature_3"),
        t("studio_features_discover_feature_4"),
        t("studio_features_discover_feature_5"),
      ],
      availableIn: ["free", "basic", "pro", "enterprise"],
    },
    {
      icon: Brain,
      title: t("studio_features_analysis_title"),
      description: t("studio_features_analysis_description"),
      features: [
        t("studio_features_analysis_feature_1"),
        t("studio_features_analysis_feature_2"),
        t("studio_features_analysis_feature_3"),
        t("studio_features_analysis_feature_4"),
        t("studio_features_analysis_feature_5"),
      ],
      availableIn: ["basic", "pro", "enterprise"],
    },
    {
      icon: Sparkles,
      title: t("studio_features_generation_title"),
      description: t("studio_features_generation_description"),
      features: [
        t("studio_features_generation_feature_1"),
        t("studio_features_generation_feature_2"),
        t("studio_features_generation_feature_3"),
        t("studio_features_generation_feature_4"),
        t("studio_features_generation_feature_5"),
      ],
      availableIn: ["basic", "pro", "enterprise"],
    },
    {
      icon: Calendar,
      title: t("studio_features_queue_title"),
      description: t("studio_features_queue_description"),
      features: [
        t("studio_features_queue_feature_1"),
        t("studio_features_queue_feature_2"),
        t("studio_features_queue_feature_3"),
        t("studio_features_queue_feature_4"),
        t("studio_features_queue_feature_5"),
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
      title: t("studio_usecase_content_creators"),
      description: t("studio_usecase_content_creators_description"),
      icon: Eye,
    },
    {
      title: t("studio_usecase_marketers"),
      description: t("studio_usecase_marketers_description"),
      icon: TrendingUp,
    },
    {
      title: t("studio_usecase_brands"),
      description: t("studio_usecase_brands_description"),
      icon: Sparkles,
    },
    {
      title: t("studio_usecase_agencies"),
      description: t("studio_usecase_agencies_description"),
      icon: Calendar,
    },
  ];

  const titleParts = t("features_title").split(" ");
  const titleFirst = titleParts.slice(0, 3).join(" ");
  const titleSecond = titleParts.slice(3).join(" ");

  return (
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: Sparkles, text: t("features_badge") }}
        title={
          <>
            {titleFirst}{" "}
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              {titleSecond}
            </span>
          </>
        }
        description={t("features_description")}
      />

      {/* Studio Features */}
      <StudioSection>
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-primary">
            {t("studio_features_pillars")}
          </h2>
          <p className="mx-auto max-w-[500px] text-base text-dim-2">
            {t("studio_features_pillars_description")}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {STUDIO_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-overlay-xs border border-overlay-sm rounded-[14px] overflow-hidden hover:border-overlay-lg transition-colors"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-studio-accent/15">
                      <Icon className="h-5 w-5 text-studio-accent" />
                    </div>
                    <div className="flex gap-1">
                      {feature.availableIn.map((tier) => (
                        <span
                          key={tier}
                          className="text-sm font-semibold uppercase tracking-[0.5px] text-dim-3 border border-overlay-md rounded px-1.5 py-0.5"
                        >
                          {tier}
                        </span>
                      ))}
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-studio-fg mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-dim-2 leading-[1.6] mb-4">
                    {feature.description}
                  </p>
                </div>
                <div className="px-5 pb-5">
                  <ul className="space-y-1.5">
                    {feature.features.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-dim-2"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400/70 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </StudioSection>

      {/* Platform Features */}
      <StudioSection variant="muted">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-primary">
            {t("common_platform_features")}
          </h2>
          <p className="mx-auto max-w-[500px] text-base text-dim-2">
            {t("features_platform_description")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-overlay-xs border border-overlay-sm rounded-[14px] p-5 hover:border-overlay-lg transition-colors"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-studio-accent/15">
                  <Icon className="h-5 w-5 text-studio-accent" />
                </div>
                <h3 className="text-base font-bold text-studio-fg mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-dim-2 leading-[1.6] mb-3">
                  {feature.description}
                </p>
                <div className="space-y-1 pt-3 border-t border-overlay-sm">
                  <p className="text-sm font-semibold text-dim-3 uppercase tracking-[1px]">
                    {t("features_available_in")}
                  </p>
                  <p className="text-sm text-dim-2">
                    <span className="font-medium text-studio-fg">
                      {t("subscription_basic")}:
                    </span>{" "}
                    {feature.tiers.basic}
                  </p>
                  <p className="text-sm text-dim-2">
                    <span className="font-medium text-studio-fg">
                      {t("subscription_pro")}:
                    </span>{" "}
                    {feature.tiers.pro}
                  </p>
                  <p className="text-sm text-dim-2">
                    <span className="font-medium text-studio-fg">
                      {t("subscription_enterprise")}:
                    </span>{" "}
                    {feature.tiers.enterprise}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </StudioSection>

      {/* Use Cases */}
      <StudioSection>
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-primary">
            {t("studio_usecase_perfect_for")}
          </h2>
          <p className="mx-auto max-w-[500px] text-base text-dim-2">
            {t("studio_usecase_perfect_for_description")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((useCase, index) => (
            <StudioFeatureCard
              key={index}
              icon={useCase.icon}
              title={useCase.title}
              description={useCase.description}
              hoverable
            />
          ))}
        </div>
      </StudioSection>

      {/* CTA */}
      <StudioSection variant="gradient" maxWidth="3xl">
        <div className="text-center">
          <h2 className="mb-3 text-2xl font-bold text-primary">
            {t("features_ready_to_start")}
          </h2>
          <p className="mb-7 text-base text-dim-2">
            {t("features_ready_description")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/pricing"
              className="bg-gradient-to-br from-studio-accent to-studio-purple text-white text-base font-bold px-6 py-2.5 rounded-lg no-underline hover:opacity-85 transition-opacity flex items-center justify-center gap-2"
            >
              {t("common_view_pricing_plans")}{" "}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/sign-up"
              className="bg-overlay-sm border border-overlay-md text-dim-1 text-base font-semibold px-6 py-2.5 rounded-lg no-underline hover:bg-overlay-md hover:text-studio-fg transition-all"
            >
              {t("home_hero_cta_start_trial")}
            </Link>
          </div>
        </div>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/(public)/features")({
  component: FeaturesPage,
});
