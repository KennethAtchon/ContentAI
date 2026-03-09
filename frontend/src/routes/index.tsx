import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { Card, CardContent } from "@/shared/components/ui/card";
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
    <PageLayout variant="public">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5" />
        <div className="container relative py-24 md:py-32 lg:py-40">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">
                {t("home_hero_badge")}
              </span>
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              {t("home_hero_title_line1")}
              <span className="block bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2">
                {t("home_hero_title_line2")}
              </span>
            </h1>
            <p className="mb-10 text-xl text-muted-foreground md:text-2xl max-w-3xl mx-auto leading-relaxed">
              {t("home_hero_description")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="text-lg px-8 h-12 shadow-lg hover:shadow-xl transition-all saas-button"
                onClick={handleGetStarted}
              >
                {t("home_hero_cta_start_trial")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-lg px-8 h-12 border-2 saas-button"
              >
                <Link to={REDIRECT_PATHS.PRICING}>
                  {t("home_hero_cta_view_pricing")}
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {t("home_hero_footer")}
            </p>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-b bg-muted/30 py-8">
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-12 text-center">
            {[
              { label: t("home_social_proof_reels"), value: "2.4M+" },
              { label: t("home_social_proof_creators"), value: "12K+" },
              { label: t("home_social_proof_hooks"), value: "890K+" },
              { label: t("home_social_proof_lift"), value: "+43%" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="container py-20 md:py-28">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {t("home_features_title")}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("home_features_description")}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="group border-2 transition-all hover:border-primary/50 hover:shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {t("home_features_discover_title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("home_features_discover_description")}
              </p>
            </CardContent>
          </Card>
          <Card className="group border-2 transition-all hover:border-primary/50 hover:shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 transition-transform group-hover:scale-110">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {t("home_features_analyze_title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("home_features_analyze_description")}
              </p>
            </CardContent>
          </Card>
          <Card className="group border-2 transition-all hover:border-primary/50 hover:shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 transition-transform group-hover:scale-110">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {t("home_features_generate_title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("home_features_generate_description")}
              </p>
            </CardContent>
          </Card>
          <Card className="group border-2 transition-all hover:border-primary/50 hover:shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 transition-transform group-hover:scale-110">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {t("home_features_queue_title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("home_features_queue_description")}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Why choose section */}
      <section className="border-y bg-gradient-to-b from-muted/50 to-background py-20 md:py-28">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                {t("about_why_choose_reelstudio")}
              </h2>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">
                  {t("home_benefits_accurate_title")}
                </h3>
                <p className="text-muted-foreground">
                  {t("home_benefits_accurate_description")}
                </p>
              </div>
              <div className="text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">
                  {t("home_benefits_export_title")}
                </h3>
                <p className="text-muted-foreground">
                  {t("home_benefits_export_description")}
                </p>
              </div>
              <div className="text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
                  <Shield className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">
                  {t("home_benefits_secure_title")}
                </h3>
                <p className="text-muted-foreground">
                  {t("home_benefits_secure_description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="container py-20 md:py-28">
        <Card className="border-2 bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5">
          <CardContent className="p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {t("features_ready_to_start")}
            </h2>
            <p className="mb-8 mx-auto max-w-2xl text-lg text-muted-foreground">
              {t("home_cta_description")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8 h-12 shadow-lg">
                <Link to={REDIRECT_PATHS.PRICING}>
                  {t("common_view_pricing_plans")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-lg px-8 h-12 border-2"
              >
                <Link to="/contact">{t("home_cta_contact_sales")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
