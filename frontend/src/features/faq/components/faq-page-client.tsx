"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  getFAQCategories,
  type FAQCategory,
} from "@/features/faq/data/faq-data";
import FAQCategories from "@/features/faq/components/faq-categories";
import FAQSearch from "@/features/faq/components/faq-search";

const filterFAQsBySearchTerm = (
  categories: FAQCategory[],
  searchTerm: string
): FAQCategory[] => {
  if (!searchTerm) {
    return categories;
  }

  const lowerSearchTerm = searchTerm.toLowerCase();

  return categories
    .map((category: FAQCategory) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.question.toLowerCase().includes(lowerSearchTerm) ||
          item.answer.toLowerCase().includes(lowerSearchTerm)
      ),
    }))
    .filter((category: FAQCategory) => category.items.length > 0);
};

export default function FAQPageClient() {
  const { t } = useTranslation();
  const faqCategories = useMemo(() => getFAQCategories(t), [t]);
  const [filteredFAQs, setFilteredFAQs] = useState(faqCategories);

  const handleSearch = (searchTerm: string) => {
    const filtered = filterFAQsBySearchTerm(faqCategories, searchTerm);
    setFilteredFAQs(filtered);
  };

  return (
    <section className="bg-gradient-to-br from-gray-50 to-white py-16 md:py-24">
      <div className="container">
        <FAQSearch onSearch={handleSearch} />
        <FAQCategories categories={filteredFAQs} />
      </div>
    </section>
  );
}
