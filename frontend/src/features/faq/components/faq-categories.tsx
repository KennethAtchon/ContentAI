import { FileText } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import FAQAccordion from "./faq-accordion";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const EMPTY_STATE = {
  TITLE: "No FAQs Found",
  DESCRIPTION:
    "Try adjusting your search terms or browse all categories below.",
} as const;

interface FAQCategoriesProps {
  categories: FAQCategory[];
}

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="rounded-full bg-gradient-to-r from-teal-100 to-blue-100 p-6 mb-6">
      <FileText className="h-12 w-12 text-teal-600" />
    </div>
    <h3 className="text-2xl font-bold text-gray-900 mb-2">
      {EMPTY_STATE.TITLE}
    </h3>
    <p className="text-lg text-gray-600">{EMPTY_STATE.DESCRIPTION}</p>
  </div>
);

export default function FAQCategories({ categories }: FAQCategoriesProps) {
  if (categories.length === 0) {
    return <EmptyState />;
  }

  const categoryText = `${categories.length} ${categories.length === 1 ? "Category" : "Categories"} Found`;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <Badge
          variant="outline"
          className="bg-white border-teal-200 text-teal-800"
        >
          <FileText className="w-4 h-4 mr-2" />
          {categoryText}
        </Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {categories.map((category, index) => (
          <FAQAccordion
            key={index}
            items={category.items}
            categoryTitle={category.title}
          />
        ))}
      </div>
    </div>
  );
}
