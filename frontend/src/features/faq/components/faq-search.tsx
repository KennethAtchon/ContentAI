/**
 * FAQ Search Component - Modern SaaS Design
 *
 * Search input for FAQ page with modern SaaS styling.
 */

"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";

const SEARCH_CONFIG = {
  PLACEHOLDER: "Search for answers...",
  HELP_TEXT:
    'Try searching for "subscription", "pricing", "calculators", or "features"',
} as const;

interface FAQSearchProps {
  onSearch: (term: string) => void;
}

export default function FAQSearch({ onSearch }: FAQSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  return (
    <div className="mx-auto mb-12 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={SEARCH_CONFIG.PLACEHOLDER}
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full h-14 pl-12 text-lg border-2 focus:border-primary rounded-xl shadow-sm"
        />
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        {SEARCH_CONFIG.HELP_TEXT}
      </p>
    </div>
  );
}
