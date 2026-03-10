import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioHero } from "@/shared/components/layout/studio-hero";
import { StudioSection } from "@/shared/components/custom-ui/studio-section";
import { StudioFeatureCard } from "@/shared/components/custom-ui/studio-feature-card";
import { useTranslation } from "react-i18next";
import {
  Target,
  Users,
  Award,
  ArrowRight,
  Sparkles,
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
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: Sparkles, text: t("about_our_story") }}
        title={
          <>
            {t("navigation_about")}{" "}
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              {APP_NAME}
            </span>
          </>
        }
        description={t("about_reelstudio_description")}
      />

      {/* Mission */}
      <StudioSection>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-8 md:p-12">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-studio-accent/15">
            <Target className="h-7 w-7 text-studio-accent" />
          </div>
          <h2 className="mb-4 text-[22px] font-bold text-slate-100">
            {t("common_our_mission")}
          </h2>
          <p className="mb-3 text-[13px] text-slate-200/50 leading-[1.7]">
            {t("about_mission_paragraph_1")}
          </p>
          <p className="text-[13px] text-slate-200/50 leading-[1.7]">
            {t("about_mission_paragraph_2")}
          </p>
        </div>
      </StudioSection>

      {/* Values */}
      <StudioSection variant="muted">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-[22px] font-bold text-slate-100">
            {t("common_our_values")}
          </h2>
          <p className="mx-auto max-w-[500px] text-[13px] text-slate-200/40">
            {t("common_the_principles_that_guide_everything_we_do")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <StudioFeatureCard
              key={i}
              icon={v.icon}
              title={v.title}
              description={v.description}
              hoverable
            />
          ))}
        </div>
      </StudioSection>

      {/* Team */}
      <StudioSection>
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-[22px] font-bold text-slate-100">
            {t("about_why_choose_reelstudio")}
          </h2>
          <p className="mx-auto max-w-[500px] text-[13px] text-slate-200/40">
            {t("common_built_by_experts_trusted_by_professionals")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TEAM_HIGHLIGHTS.map((h, i) => (
            <StudioFeatureCard
              key={i}
              icon={Award}
              title={h.title}
              description={h.description}
              hoverable
            />
          ))}
        </div>
      </StudioSection>

      {/* Content Intelligence */}
      <StudioSection variant="gradient">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-8 md:p-12">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-studio-accent/15">
              <Sparkles className="h-7 w-7 text-studio-accent" />
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-slate-100">
                {t("about_content_intelligence")}
              </h2>
              <p className="text-[12px] text-slate-200/40">
                AI-powered insights from millions of viral reels
              </p>
            </div>
          </div>
          <div className="space-y-3 text-[13px] text-slate-200/50 leading-[1.7]">
            <p>{t("about_content_intelligence_description_1")}</p>
            <p>{t("about_content_intelligence_description_2")}</p>
            <p>{t("about_content_intelligence_description_3")}</p>
          </div>
        </div>
      </StudioSection>

      {/* CTA */}
      <StudioSection maxWidth="3xl">
        <div className="text-center">
          <h2 className="mb-3 text-[22px] font-bold text-slate-100">
            {t("about_ready_to_experience")}
          </h2>
          <p className="mb-7 text-[13px] text-slate-200/40">
            {t("about_join_thousands")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/pricing"
              className="bg-gradient-to-br from-studio-accent to-studio-purple text-white text-[13px] font-bold px-6 py-2.5 rounded-lg no-underline hover:opacity-85 transition-opacity flex items-center justify-center gap-2"
            >
              {t("common_view_pricing_plans")}{" "}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="bg-white/[0.05] border border-white/[0.08] text-slate-200/60 text-[13px] font-semibold px-6 py-2.5 rounded-lg no-underline hover:bg-white/[0.08] hover:text-studio-fg transition-all"
            >
              {t("contact_metadata_title")}
            </Link>
          </div>
        </div>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/(public)/about")({
  component: AboutPage,
});
