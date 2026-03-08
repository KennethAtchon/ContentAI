/**
 * Pricing Page - Modern SaaS Design
 *
 * Display all subscription tiers with features and pricing in a modern SaaS layout.
 */

import { createFileRoute } from "@tanstack/react-router";
import { PricingInteractive } from "./pricing/-pricing-interactive";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { HeroSection } from "@/shared/components/layout/hero-section";
import { Section } from "@/shared/components/custom-ui/section";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
    <PageLayout variant="public">
      <HeroSection
        badge={{
          icon: CheckCircle2,
          text: t("home_hero_badge"),
        }}
        title={
          <>
            <span>{titleFirst}</span>
            <span className="block bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2 pb-2">
              {titleSecond}
            </span>
          </>
        }
        description={t("pricing_description")}
      />

      {/* Interactive Pricing Section - Full Width */}
      <PricingInteractive />

      {/* FAQ Section */}
      <Section maxWidth="3xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("common_frequently_asked_questions")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("common_everything_you_need_to_know_about_our_pricing")}
          </p>
        </div>
        <Card className="border-2">
          <CardContent className="p-6">
            <Accordion type="single" collapsible className="w-full">
              {pricingFAQs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border-b"
                >
                  <AccordionTrigger className="text-left font-semibold hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </Section>

      {/* CTA Section */}
      <Section variant="gradient" maxWidth="3xl">
        <Card className="border-2 bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5">
          <CardContent className="p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {t("pricing_ready_title")}
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              {t(
                "common_start_your_14_day_free_trial_today_no_credit_card_required"
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8 h-12 shadow-lg">
                <Link
                  to={REDIRECT_PATHS.CHECKOUT}
                  search={{ tier: SUBSCRIPTION_TIERS.PRO, billing: "monthly" }}
                >
                  {t("home_hero_cta_start_trial")}
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
      </Section>
    </PageLayout>
  );
}

export const Route = createFileRoute("/(public)/pricing")({
  component: PricingPage,
});
