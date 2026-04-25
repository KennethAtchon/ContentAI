/**
 * Help Modal Component - Modern SaaS Design
 *
 * Help modal for admin dashboard with guidance on using each section.
 */

"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/primitives/dialog";
import {
  HelpCircle,
  LayoutDashboard,
  CreditCard,
  ShoppingCart,
  Users,
  Mail,
  Code,
  Settings,
} from "lucide-react";

interface HelpItem {
  section: string;
  description: string;
  icon: React.ElementType;
}

// Help items are now translated - moved to component

function HelpListItem({ section, description, icon: Icon }: HelpItem) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-base mb-1">{section}</h3>
        <p className="text-base text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function HelpModal() {
  const { t } = useTranslation();

  const helpItems: HelpItem[] = [
    {
      section: t("admin_help_dashboard_section"),
      description: t("admin_help_dashboard_description"),
      icon: LayoutDashboard,
    },
    {
      section: t("metadata_admin_subscriptions_title"),
      description: t("admin_help_subscriptions_description"),
      icon: CreditCard,
    },
    {
      section: t("metadata_admin_orders_title"),
      description: t("admin_help_orders_description"),
      icon: ShoppingCart,
    },
    {
      section: t("metadata_admin_customers_title"),
      description: t("admin_help_customers_description"),
      icon: Users,
    },
    {
      section: t("metadata_admin_contact_messages_title"),
      description: t("admin_help_messages_description"),
      icon: Mail,
    },
    {
      section: t("admin_help_developer_section"),
      description: t("admin_help_developer_description"),
      icon: Code,
    },
    {
      section: t("metadata_admin_settings_title"),
      description: t("admin_help_settings_description"),
      icon: Settings,
    },
  ];

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-xl flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          {t("common_dashboard_help")}
        </DialogTitle>
        <DialogDescription className="pt-2">
          {t(
            "common_quick_guide_on_how_to_use_each_section_of_the_admin_dashboard"
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {helpItems.map((item) => (
          <HelpListItem key={item.section} {...item} />
        ))}
      </div>

      <div className="pt-4 border-t">
        <p className="text-base text-muted-foreground">
          {t(
            "common_if_you_need_further_assistance_please_contact_support_or_ref"
          )}
        </p>
      </div>
    </DialogContent>
  );
}
