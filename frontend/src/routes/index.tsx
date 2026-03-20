import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  TrendingUp,
  Shield,
  Zap,
  ArrowRight,
  Sparkles,
  BarChart3,
  Search,
  Cpu,
  Calendar,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useSmartRedirect,
  REDIRECT_PATHS,
} from "@/shared/utils/redirect/redirect-util";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioHero } from "@/shared/components/layout/studio-hero";
import { StudioSection } from "@/shared/components/custom-ui/studio-section";
import { StudioFeatureCard } from "@/shared/components/custom-ui/studio-feature-card";

function HomePage() {
  const { t } = useTranslation();
  const { smartRedirect, redirectToAuth, userContext } = useSmartRedirect();

  const handleGetStarted = () => {
    if (userContext === "new_user" || userContext === "authenticated_user") {
      redirectToAuth({
        isSignUp: true,
        returnUrl: window.location.origin + REDIRECT_PATHS.PRICING,
      });
    } else {
      smartRedirect({ intendedDestination: REDIRECT_PATHS.PRICING });
    }
  };

  return (
    <StudioShell variant="public" showFooter>
      {/* Hero */}
      <StudioHero
        badge={{ icon: Sparkles, text: t("home_hero_badge") }}
        title={
          <>
            {t("home_hero_title_line1")}
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              {t("home_hero_title_line2")}
            </span>
          </>
        }
        description={t("home_hero_description")}
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-8">
          <button
            onClick={handleGetStarted}
            className="bg-gradient-to-br from-studio-accent to-studio-purple text-white text-base font-bold px-7 py-3 rounded-lg border-0 cursor-pointer transition-opacity hover:opacity-85 font-studio flex items-center gap-2"
          >
            {t("home_hero_cta_start_trial")}
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link
            to={REDIRECT_PATHS.PRICING}
            className="bg-overlay-sm border border-overlay-md text-dim-1 text-base font-semibold px-7 py-3 rounded-lg no-underline cursor-pointer transition-all hover:bg-overlay-md hover:text-studio-fg font-studio"
          >
            {t("home_hero_cta_view_pricing")}
          </Link>
        </div>
        <p className="mt-5 text-sm text-dim-3">{t("home_hero_footer")}</p>
      </StudioHero>

      {/* Social proof bar */}
      <section className="border-b border-overlay-sm bg-overlay-xs py-7">
        <div className="max-w-[900px] mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16 text-center">
            {[
              { label: t("home_social_proof_reels"), value: "2.4M+" },
              { label: t("home_social_proof_creators"), value: "12K+" },
              { label: t("home_social_proof_hooks"), value: "890K+" },
              { label: t("home_social_proof_lift"), value: "+43%" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-studio-accent font-studio-mono">
                  {value}
                </p>
                <p className="text-sm text-dim-3 uppercase tracking-[1px] mt-1">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <StudioSection>
        <div className="text-center mb-10">
          <h2 className="mb-3 text-2xl font-bold text-primary">
            {t("home_features_title")}
          </h2>
          <p className="mx-auto max-w-[500px] text-base text-dim-2">
            {t("home_features_description")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StudioFeatureCard
            icon={Search}
            title={t("home_features_discover_title")}
            description={t("home_features_discover_description")}
            hoverable
          />
          <StudioFeatureCard
            icon={Cpu}
            title={t("home_features_analyze_title")}
            description={t("home_features_analyze_description")}
            hoverable
          />
          <StudioFeatureCard
            icon={Zap}
            title={t("home_features_generate_title")}
            description={t("home_features_generate_description")}
            hoverable
          />
          <StudioFeatureCard
            icon={Calendar}
            title={t("home_features_queue_title")}
            description={t("home_features_queue_description")}
            hoverable
          />
        </div>
      </StudioSection>

      {/* Why choose section */}
      <StudioSection variant="muted">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold text-primary">
              {t("about_why_choose_reelstudio")}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-studio-accent/15">
                <BarChart3 className="h-7 w-7 text-studio-accent" />
              </div>
              <h3 className="mb-1.5 text-base font-bold text-studio-fg">
                {t("home_benefits_accurate_title")}
              </h3>
              <p className="text-sm text-dim-2 leading-[1.6]">
                {t("home_benefits_accurate_description")}
              </p>
            </div>
            <div className="text-center">
              <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-studio-purple/15">
                <TrendingUp className="h-7 w-7 text-studio-purple" />
              </div>
              <h3 className="mb-1.5 text-base font-bold text-studio-fg">
                {t("home_benefits_export_title")}
              </h3>
              <p className="text-sm text-dim-2 leading-[1.6]">
                {t("home_benefits_export_description")}
              </p>
            </div>
            <div className="text-center">
              <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-studio-accent/15">
                <Shield className="h-7 w-7 text-studio-accent" />
              </div>
              <h3 className="mb-1.5 text-base font-bold text-studio-fg">
                {t("home_benefits_secure_title")}
              </h3>
              <p className="text-sm text-dim-2 leading-[1.6]">
                {t("home_benefits_secure_description")}
              </p>
            </div>
          </div>
        </div>
      </StudioSection>

      {/* CTA section */}
      <StudioSection maxWidth="3xl">
        <div className="bg-overlay-xs border border-overlay-sm rounded-[14px] p-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-primary">
            {t("features_ready_to_start")}
          </h2>
          <p className="mb-7 mx-auto max-w-[500px] text-base text-dim-2">
            {t("home_cta_description")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={REDIRECT_PATHS.PRICING}
              className="bg-gradient-to-br from-studio-accent to-studio-purple text-white text-base font-bold px-6 py-2.5 rounded-lg no-underline hover:opacity-85 transition-opacity flex items-center justify-center gap-2"
            >
              {t("common_view_pricing_plans")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="bg-overlay-sm border border-overlay-md text-dim-1 text-base font-semibold px-6 py-2.5 rounded-lg no-underline hover:bg-overlay-md hover:text-studio-fg transition-all"
            >
              {t("home_cta_contact_sales")}
            </Link>
          </div>
        </div>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
