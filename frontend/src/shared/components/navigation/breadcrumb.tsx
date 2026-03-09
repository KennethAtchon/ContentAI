"use client";

import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { StructuredDataStatic } from "@/shared/components/marketing/structured-data";
import { generateBreadcrumbSchema } from "@/shared/services/seo/structured-data";
import { BASE_URL } from "@/shared/utils/config/envUtil";
import { useTranslation } from "react-i18next";

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

// Path to label mapping for automatic breadcrumb generation
const pathLabels: Record<string, string> = {
  "": "Home",
  about: "About Us",
  therapies: "IV Therapies",
  contact: "Contact",
  faq: "FAQ",
  checkout: "Checkout",
  account: "My Account",
  locations: "Locations",
  chicago: "Chicago",
  "northwest-indiana": "Northwest Indiana",
  "sign-in": "Sign In",
  "sign-up": "Sign Up",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ name: "Home", href: "/" }];

  let currentPath = "";

  pathSegments.forEach((segment) => {
    currentPath += `/${segment}`;
    const label =
      pathLabels[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");

    breadcrumbs.push({
      name: label,
      href: currentPath,
    });
  });

  return breadcrumbs;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const breadcrumbs = items || generateBreadcrumbsFromPath(pathname);

  // Don't show breadcrumbs on homepage
  if (pathname === "/" || breadcrumbs.length <= 1) {
    return null;
  }

  // Generate structured data for breadcrumbs
  const breadcrumbSchema = generateBreadcrumbSchema(
    breadcrumbs.map((item) => ({
      name: item.name,
      url: `${BASE_URL !== "[BASE_URL]" ? BASE_URL : "[BASE_URL]"}${item.href}`,
    }))
  );

  return (
    <>
      <StructuredDataStatic data={[breadcrumbSchema]} id="breadcrumb" />
      <nav
        className={`bg-gray-50 border-b ${className}`}
        aria-label={t("navigation_breadcrumb")}
      >
        <div className="container py-4">
          <ol className="flex items-center space-x-2 text-sm">
            {breadcrumbs.map((breadcrumb, index) => {
              const isLast = index === breadcrumbs.length - 1;

              return (
                <li key={breadcrumb.href} className="flex items-center">
                  {index > 0 && (
                    <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
                  )}

                  {isLast ? (
                    <span className="text-gray-900 font-medium flex items-center">
                      {index === 0 && <Home className="w-4 h-4 mr-1" />}
                      {breadcrumb.name}
                    </span>
                  ) : (
                    <Link
                      to={breadcrumb.href}
                      className="text-gray-600 hover:text-teal-600 transition-colors flex items-center"
                    >
                      {index === 0 && <Home className="w-4 h-4 mr-1" />}
                      {breadcrumb.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </>
  );
}

// Medical-specific breadcrumb component for therapy pages
interface MedicalBreadcrumbProps {
  therapyName?: string;
  categoryName?: string;
  className?: string;
}

export function MedicalBreadcrumb({
  therapyName,
  categoryName,
  className = "",
}: MedicalBreadcrumbProps) {
  const breadcrumbs: BreadcrumbItem[] = [
    { name: "Home", href: "/" },
    { name: "IV Therapies", href: "/therapies" },
  ];

  if (categoryName) {
    breadcrumbs.push({
      name: categoryName,
      href: `/therapies?category=${encodeURIComponent(categoryName)}`,
    });
  }

  if (therapyName) {
    breadcrumbs.push({
      name: therapyName,
      href: `/therapies/${therapyName.toLowerCase().replace(/\s+/g, "-")}`,
    });
  }

  return <Breadcrumb items={breadcrumbs} className={className} />;
}

// Location-specific breadcrumb component
interface LocationBreadcrumbProps {
  locationName: string;
  className?: string;
}

export function LocationBreadcrumb({
  locationName,
  className = "",
}: LocationBreadcrumbProps) {
  const breadcrumbs: BreadcrumbItem[] = [
    { name: "Home", href: "/" },
    { name: "Service Locations", href: "/locations" },
    {
      name: locationName,
      href: `/locations/${locationName.toLowerCase().replace(/\s+/g, "-")}`,
    },
  ];

  return <Breadcrumb items={breadcrumbs} className={className} />;
}
