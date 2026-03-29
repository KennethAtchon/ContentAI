import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PricingInteractive } from "./pricing/-pricing-interactive";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioHero } from "@/shared/components/layout/studio-hero";
import { StudioSection } from "@/shared/components/layout/studio-section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { SUBSCRIPTION_TIERS } from "@/shared/constants/subscription.constants";
import { useTranslation } from "react-i18next";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";

function PricingPage() {
  const { t } = useTranslation();

  const pricingFAQs = [
    {
      question: t("faq_subscriptions_change"),
      answer: t("pricing_faq_change_plan_answer"),
    },
    {
      question: t("faq_subscriptions_exceed"),
      answer: t("pricing_faq_exceed_limit_answer"),
    },
    {
      question: t("faq_subscriptions_refunds"),
      answer: t("pricing_faq_refunds_answer"),
    },
    {
      question: t("faq_subscriptions_cancel"),
      answer: t("pricing_faq_cancel_answer"),
    },
    {
      question: t("pricing_faq_payment_methods"),
      answer: t("pricing_faq_payment_methods_answer"),
    },
    {
      question: t("faq_subscriptions_trial"),
      answer: t("pricing_faq_free_trial_answer"),
    },
  ];

  const titleParts = t("pricing_title").split(" ");
  const titleFirst = titleParts.slice(0, 2).join(" ");
  const titleSecond = titleParts.slice(2).join(" ");

  return (
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: CheckCircle2, text: t("home_hero_badge") }}
        title={
          <>
            <span>{titleFirst}</span>
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2 pb-2">
              {titleSecond}
            </span>
          </>
        }
        description={t("pricing_description")}
      />

      <PricingInteractive />

      {/* FAQ */}
      <StudioSection maxWidth="3xl">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-primary">
            {t("common_frequently_asked_questions")}
          </h2>
          <p className="text-base text-dim-2">
            {t("common_everything_you_need_to_know_about_our_pricing")}
          </p>
        </div>
        <div className="bg-overlay-xs border border-overlay-sm rounded-[14px] p-6">
          <Accordion type="single" collapsible className="w-full">
            {pricingFAQs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-b border-overlay-sm"
              >
                <AccordionTrigger className="text-left text-base font-semibold text-studio-fg hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-dim-2 leading-[1.7]">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </StudioSection>

      {/* CTA */}
      <StudioSection variant="gradient" maxWidth="3xl">
        <div className="bg-overlay-xs border border-overlay-sm rounded-[14px] p-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-primary">
            {t("pricing_ready_title")}
          </h2>
          <p className="mb-7 text-base text-dim-2">
            {t(
              "common_start_your_14_day_free_trial_today_no_credit_card_required"
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={REDIRECT_PATHS.CHECKOUT}
              search={
                { tier: SUBSCRIPTION_TIERS.PRO, billing: "monthly" } as any
              }
              className="bg-gradient-to-br from-studio-accent to-studio-purple text-white text-base font-bold px-6 py-2.5 rounded-lg no-underline hover:opacity-85 transition-opacity flex items-center justify-center gap-2"
            >
              {t("home_hero_cta_start_trial")}{" "}
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

export const Route = createFileRoute("/(public)/pricing")({
  component: PricingPage,
});
