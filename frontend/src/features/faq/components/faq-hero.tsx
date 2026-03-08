/**
 * FAQ Hero Component - Modern SaaS Design
 *
 * Hero section for FAQ page with modern SaaS styling.
 */

"use client";

import { useTranslation } from "react-i18next";
import { HelpCircle, Search, Clock } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";

export default function FAQHero() {
  const { t } = useTranslation();

  const HERO_CONTENT = {
    BADGE_TEXT: t("faq_hero_badge"),
    TITLE: t("common_frequently_asked_questions"),
    DESCRIPTION: t("faq_hero_description"),
  };

  const FAQ_FEATURES = [
    { icon: Search, label: t("faq_hero_search_faqs") },
    { icon: Clock, label: t("faq_hero_24_7_support") },
    { icon: HelpCircle, label: t("faq_hero_expert_answers") },
  ];

  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5" />
      <div className="container relative py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 px-4 py-1.5">
            <HelpCircle className="w-4 h-4 mr-2" />
            {HERO_CONTENT.BADGE_TEXT}
          </Badge>

          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Frequently Asked
            <span className="block bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2">
              Questions
            </span>
          </h1>

          <p className="text-xl text-muted-foreground md:text-2xl max-w-2xl mx-auto">
            {HERO_CONTENT.DESCRIPTION}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {FAQ_FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-primary" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
