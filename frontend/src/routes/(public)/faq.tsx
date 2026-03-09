import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { HeroSection } from "@/shared/components/layout/hero-section";
import { Section } from "@/shared/components/custom-ui/section";
import { HelpCircle, Sparkles, ArrowRight } from "lucide-react";
function getFAQCategories(_t: (k: string) => string) { return [] as Array<{ title: string; items: Array<{ question: string; answer: string }> }>; }
import { generateFAQSchema } from "@/shared/services/seo/structured-data";
import { StructuredDataStatic } from "@/shared/components/marketing/structured-data";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function FaqPage() {
  const { t } = useTranslation();
  const faqCategories = getFAQCategories(t);

  const allFAQs = faqCategories.flatMap((category) =>
    category.items.map((item) => ({
      question: item.question,
      answer: item.answer,
    }))
  );

  const faqSchema = generateFAQSchema(allFAQs);

  return (
    <PageLayout variant="public">
      <StructuredDataStatic data={faqSchema} id="faq-page" />
      <HeroSection
        badge={{ icon: HelpCircle, text: t("faq_badge") }}
        title={
          <>
            {t("common_frequently_asked_questions")
              .split(" ")
              .slice(0, 2)
              .join(" ")}
            <span className="block bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2">
              {t("common_frequently_asked_questions")
                .split(" ")
                .slice(2)
                .join(" ")}
            </span>
          </>
        }
        description={t("faq_metadata_description")}
      />

      <Section maxWidth="4xl">
        <div className="space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <Card key={categoryIndex} className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <HelpCircle className="h-5 w-5 text-primary" />
                  </div>
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, itemIndex) => (
                    <AccordionItem
                      key={itemIndex}
                      value={`category-${categoryIndex}-item-${itemIndex}`}
                      className="border-b last:border-b-0"
                    >
                      <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-4">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section variant="gradient" maxWidth="3xl">
        <Card className="border-2 bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5">
          <CardContent className="p-12 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {t("faq_still_have_questions")}
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              {t("faq_cant_find")}
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-primary hover:underline font-semibold"
            >
              {t("common_contact_support")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </Section>
    </PageLayout>
  );
}

export const Route = createFileRoute("/(public)/faq")({
  component: FaqPage,
});
