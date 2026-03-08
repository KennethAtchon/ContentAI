"use client";

import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  categoryTitle: string;
}

export default function FAQAccordion({
  items,
  categoryTitle,
}: FAQAccordionProps) {
  const badgeText = `${items.length} ${items.length === 1 ? "FAQ" : "FAQs"}`;

  return (
    <Card className="border-0 bg-white shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-r from-teal-100 to-blue-100 p-2">
            <HelpCircle className="h-5 w-5 text-teal-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{categoryTitle}</h2>
          <Badge variant="outline" className="ml-auto bg-teal-50 text-teal-700">
            {badgeText}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <Accordion type="single" collapsible className="w-full space-y-2">
          {items.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-gray-200 rounded-lg px-4 hover:shadow-md transition-all duration-200 z-99 last:border-b"
            >
              <AccordionTrigger className="text-left font-semibold text-gray-900 hover:no-underline hover:text-teal-600">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-gray-700 leading-relaxed pt-2">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
