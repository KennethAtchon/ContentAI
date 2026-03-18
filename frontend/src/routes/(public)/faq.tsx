import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioHero } from "@/shared/components/layout/studio-hero";
import { StudioSection } from "@/shared/components/custom-ui/studio-section";
import { HelpCircle, Sparkles, ArrowRight } from "lucide-react";
import { generateFAQSchema } from "@/shared/services/seo/structured-data";
import { StructuredDataStatic } from "@/shared/components/marketing/structured-data";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function getFAQCategories(t: (k: string) => string) {
  return [
    {
      title: t("faq_category_getting_started"),
      items: [
        {
          question: t("faq_what_is_reelstudio"),
          answer: t("faq_what_is_reelstudio_answer"),
        },
        {
          question: t("faq_how_does_it_work"),
          answer: t("faq_how_does_it_work_answer"),
        },
        { question: t("faq_free_trial"), answer: t("faq_free_trial_answer") },
      ],
    },
    {
      title: t("faq_category_features"),
      items: [
        {
          question: t("faq_reel_discovery"),
          answer: t("faq_reel_discovery_answer"),
        },
        { question: t("faq_ai_analysis"), answer: t("faq_ai_analysis_answer") },
        {
          question: t("faq_content_generation"),
          answer: t("faq_content_generation_answer"),
        },
        {
          question: t("faq_queue_management"),
          answer: t("faq_queue_management_answer"),
        },
      ],
    },
    {
      title: t("faq_category_pricing_plans"),
      items: [
        {
          question: t("faq_pricing_difference"),
          answer: t("faq_pricing_difference_answer"),
        },
        {
          question: t("faq_usage_limits"),
          answer: t("faq_usage_limits_answer"),
        },
        {
          question: t("faq_upgrading_downgrading"),
          answer: t("faq_upgrading_downgrading_answer"),
        },
        {
          question: t("faq_cancellation"),
          answer: t("faq_cancellation_answer"),
        },
      ],
    },
    {
      title: t("faq_category_technical"),
      items: [
        {
          question: t("faq_data_privacy"),
          answer: t("faq_data_privacy_answer"),
        },
        {
          question: t("faq_instagram_integration"),
          answer: t("faq_instagram_integration_answer"),
        },
        { question: t("faq_ai_accuracy"), answer: t("faq_ai_accuracy_answer") },
      ],
    },
  ] as Array<{
    title: string;
    items: Array<{ question: string; answer: string }>;
  }>;
}

function FaqPage() {
  const { t } = useTranslation();
  const faqCategories = getFAQCategories(t);
  const allFAQs = faqCategories.flatMap((c) =>
    c.items.map((i) => ({ question: i.question, answer: i.answer }))
  );
  const faqSchema = generateFAQSchema(allFAQs);

  return (
    <StudioShell variant="public" showFooter>
      <StructuredDataStatic data={faqSchema} id="faq-page" />
      <StudioHero
        badge={{ icon: HelpCircle, text: t("faq_badge") }}
        title={
          <>
            {t("common_frequently_asked_questions")
              .split(" ")
              .slice(0, 2)
              .join(" ")}
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              {t("common_frequently_asked_questions")
                .split(" ")
                .slice(2)
                .join(" ")}
            </span>
          </>
        }
        description={t("faq_metadata_description")}
      />

      <StudioSection maxWidth="4xl">
        <div className="space-y-6">
          {faqCategories.map((category, ci) => (
            <div
              key={ci}
              className="bg-overlay-xs border border-overlay-sm rounded-[14px] overflow-hidden"
            >
              <div className="p-5 pb-2 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-accent/15">
                  <HelpCircle className="h-4.5 w-4.5 text-studio-accent" />
                </div>
                <h2 className="text-[16px] font-bold text-studio-fg">
                  {category.title}
                </h2>
              </div>
              <div className="px-5 pb-4">
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, ii) => (
                    <AccordionItem
                      key={ii}
                      value={`c${ci}-i${ii}`}
                      className="border-b border-overlay-sm last:border-b-0"
                    >
                      <AccordionTrigger className="text-left text-[13px] font-semibold text-studio-fg hover:no-underline py-3.5">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-[12px] text-dim-2 leading-[1.7] pb-3.5">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          ))}
        </div>
      </StudioSection>

      {/* CTA */}
      <StudioSection variant="gradient" maxWidth="3xl">
        <div className="bg-overlay-xs border border-overlay-sm rounded-[14px] p-10 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-studio-accent/15">
            <Sparkles className="h-7 w-7 text-studio-accent" />
          </div>
          <h2 className="mb-3 text-[22px] font-bold text-primary">
            {t("faq_still_have_questions")}
          </h2>
          <p className="mb-6 text-[13px] text-dim-2">
            {t("faq_cant_find")}
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 text-[13px] text-studio-accent font-semibold no-underline hover:underline"
          >
            {t("common_contact_support")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/(public)/faq")({ component: FaqPage });
