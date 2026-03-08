/**
 * Contact Info Component - Modern SaaS Design
 *
 * Contact information display component with modern SaaS styling.
 */

"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Clock, Mail, Phone } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";

const CONTACT_INFO = {
  EMAIL: {
    address: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
  },
  PHONE: {
    number: "(123) 456-7890",
    href: "tel:+1234567890",
  },
  HOURS: "24/7 Email Support",
} as const;

export default function ContactInfo() {
  const { t } = useTranslation();

  const CONTACT_CARDS = [
    {
      id: "email",
      icon: Mail,
      title: t("contact_info_email_us"),
      content: (
        <p className="text-lg">
          <a
            href={CONTACT_INFO.EMAIL.href}
            className="text-foreground hover:text-primary font-medium transition-colors duration-200 break-all"
          >
            {CONTACT_INFO.EMAIL.address}
          </a>
        </p>
      ),
    },
    {
      id: "phone",
      icon: Phone,
      title: t("contact_info_call_us"),
      content: (
        <p className="text-lg">
          <a
            href={CONTACT_INFO.PHONE.href}
            className="text-foreground hover:text-primary font-medium transition-colors duration-200"
          >
            {CONTACT_INFO.PHONE.number}
          </a>
        </p>
      ),
    },
    {
      id: "hours",
      icon: Clock,
      title: t("contact_info_support_hours"),
      content: (
        <p className="text-lg text-muted-foreground">
          {t("contact_info_24_7_support")}
        </p>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <Badge
          variant="outline"
          className="mb-4 bg-primary/10 border-primary/20 text-primary"
        >
          {t("contact_info_contact_details")}
        </Badge>
        <h2 className="text-3xl font-bold mb-4">
          {t("account_profile_contact_information")}
        </h2>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("contact_info_description")}
        </p>
      </div>

      <div className="grid gap-6">
        {CONTACT_CARDS.map(({ id, icon: Icon, title, content }) => (
          <Card
            key={id}
            className="group border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>{content}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
