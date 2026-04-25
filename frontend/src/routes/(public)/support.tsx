import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/shared/ui/layout/studio-shell";
import { StudioHero } from "@/shared/ui/layout/studio-hero";
import { StudioSection } from "@/shared/ui/layout/studio-section";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/primitives/accordion";
import {
  HelpCircle,
  Rocket,
  CreditCard,
  Eye,
  Brain,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";

function SupportPage() {
  const { t } = useTranslation();

  const gettingStartedSteps = [
    t("support_step_signup"),
    t("support_step_choose_plan"),
    t("support_step_discover_reels"),
    t("support_step_analyze_content"),
    t("support_step_generate_remix"),
  ];

  const accountFAQs = [
    {
      question: t("support_change_plan"),
      answer: t("support_change_plan_answer"),
    },
    {
      question: t("support_billing_question"),
      answer: t("support_billing_answer"),
    },
    {
      question: t("support_reset_question"),
      answer: t("support_reset_answer"),
    },
    {
      question: t("support_export_question"),
      answer: t("support_export_answer"),
    },
  ];

  const _troubleshootingFAQs = [
    {
      question: t("support_studio_not_loading"),
      answer: t("support_studio_not_loading_answer"),
    },
    {
      question: t("support_generation_failed"),
      answer: t("support_generation_failed_answer"),
    },
  ];

  const categories = [
    {
      title: t("support_getting_started_title"),
      description: t("support_getting_started_desc"),
      icon: Rocket,
    },
    {
      title: t("support_account_title"),
      description: t("support_account_desc"),
      icon: CreditCard,
    },
    {
      title: t("support_studio_features_title"),
      description: t("support_studio_features_desc"),
      icon: Eye,
    },
    {
      title: t("support_ai_features_title"),
      description: t("support_ai_features_desc"),
      icon: Brain,
    },
  ];

  return (
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: HelpCircle, text: t("metadata_support_title") }}
        title={
          <>
            Support
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              Center
            </span>
          </>
        }
        description={t("support_description")}
        showGradient
      />

      <StudioSection maxWidth="4xl">
        <div className="space-y-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-studio-accent/15">
                  <Icon className="h-5 w-5 text-studio-accent" />
                </div>
                <h3 className="mb-1 font-semibold">{title}</h3>
                <p className="text-base text-dim-2">{description}</p>
              </div>
            ))}
          </div>

          <Card className="bg-overlay-xs border border-overlay-sm rounded-[14px]">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-accent/15">
                  <Rocket className="h-5 w-5 text-studio-accent" />
                </div>
                {t("support_getting_started_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3">
                {gettingStartedSteps.map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-studio-accent/15 text-sm font-bold text-studio-accent">
                      {i + 1}
                    </span>
                    <span className="text-dim-2 pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="pt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                <Link
                  to="/faq"
                  className="inline-flex items-center gap-1 text-base text-studio-accent hover:underline font-medium"
                >
                  {t("support_faq_link")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-1 text-base text-studio-accent hover:underline font-medium"
                >
                  {t("support_contact_link")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-overlay-xs border border-overlay-sm rounded-[14px]">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-accent/15">
                  <CreditCard className="h-5 w-5 text-studio-accent" />
                </div>
                {t("support_account_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {accountFAQs.map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`account-${i}`}
                    className="border-b last:border-b-0"
                  >
                    <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-dim-2 pb-4">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card className="border-2 bg-overlay-xs">
            <CardContent className="p-8 md:p-12 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-studio-accent/15">
                <HelpCircle className="h-8 w-8 text-studio-accent" />
              </div>
              <h2 className="mb-4 text-2xl font-bold tracking-tight">
                {t("support_still_need_help")}
              </h2>
              <p className="mb-6 text-base text-dim-2">
                {t("support_reach_out")}
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 text-studio-accent hover:underline font-semibold text-xl"
              >
                {SUPPORT_EMAIL}
                <ArrowRight className="h-5 w-5" />
              </a>
            </CardContent>
          </Card>
        </div>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/(public)/support")({
  component: SupportPage,
});
