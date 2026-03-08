/**
 * FAQ Data - SaaS Calculator App
 *
 * Frequently asked questions about the calculator suite, subscriptions, and features.
 * This function returns FAQ categories using translations.
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQCategory {
  title: string;
  items: FAQItem[];
}

/**
 * Get FAQ categories with translated content
 * @param t - Translation function from next-intl
 */
export function getFAQCategories(t: (key: string) => string): FAQCategory[] {
  return [
    {
      title: t("faq_category_general"),
      items: [
        {
          question: t("faq_general_what_is"),
          answer: t("faq_general_what_is_answer"),
        },
        {
          question: t("faq_general_accuracy"),
          answer: t("faq_general_accuracy_answer"),
        },
        {
          question: t("faq_general_download"),
          answer: t("faq_general_download_answer"),
        },
        {
          question: t("faq_general_mobile"),
          answer: t("faq_general_mobile_answer"),
        },
      ],
    },
    {
      title: t("faq_category_subscriptions"),
      items: [
        {
          question: t("faq_subscriptions_plans"),
          answer: t("faq_subscriptions_plans_answer"),
        },
        {
          question: t("faq_subscriptions_change"),
          answer: t("faq_subscriptions_change_answer"),
        },
        {
          question: t("faq_subscriptions_exceed"),
          answer: t("faq_subscriptions_exceed_answer"),
        },
        {
          question: t("faq_subscriptions_refunds"),
          answer: t("faq_subscriptions_refunds_answer"),
        },
        {
          question: t("faq_subscriptions_cancel"),
          answer: t("faq_subscriptions_cancel_answer"),
        },
        {
          question: t("faq_subscriptions_trial"),
          answer: t("faq_subscriptions_trial_answer"),
        },
      ],
    },
    {
      title: t("faq_category_features"),
      items: [
        {
          question: t("faq_features_calculators"),
          answer: t("faq_features_calculators_answer"),
        },
        {
          question: t("faq_features_export"),
          answer: t("faq_features_export_answer"),
        },
        {
          question: t("faq_features_stored"),
          answer: t("faq_features_stored_answer"),
        },
        {
          question: t("faq_features_share"),
          answer: t("faq_features_share_answer"),
        },
        {
          question: t("faq_features_api"),
          answer: t("faq_features_api_answer"),
        },
      ],
    },
    {
      title: t("faq_category_payment"),
      items: [
        {
          question: t("pricing_faq_payment_methods"),
          answer: t("faq_payment_methods_answer"),
        },
        {
          question: t("faq_payment_billing"),
          answer: t("faq_payment_billing_answer"),
        },
        {
          question: t("faq_payment_fails"),
          answer: t("faq_payment_fails_answer"),
        },
        {
          question: t("faq_payment_invoice"),
          answer: t("faq_payment_invoice_answer"),
        },
      ],
    },
    {
      title: t("about_security_privacy"),
      items: [
        {
          question: t("faq_security_secure"),
          answer: t("faq_security_secure_answer"),
        },
        {
          question: t("faq_security_collect"),
          answer: t("faq_security_collect_answer"),
        },
        {
          question: t("faq_security_delete"),
          answer: t("faq_security_delete_answer"),
        },
      ],
    },
    {
      title: t("faq_category_support"),
      items: [
        {
          question: t("faq_support_options"),
          answer: t("faq_support_options_answer"),
        },
        {
          question: t("faq_support_contact"),
          answer: t("faq_support_contact_answer"),
        },
        {
          question: t("faq_support_training"),
          answer: t("faq_support_training_answer"),
        },
      ],
    },
  ];
}
