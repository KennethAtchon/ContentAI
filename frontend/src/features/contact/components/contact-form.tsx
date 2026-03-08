/**
 * Contact Form Component - Modern SaaS Design
 *
 * Contact form with modern SaaS styling, validation, and error handling.
 */

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Textarea } from "@/shared/components/ui/textarea";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { debugLog } from "@/shared/utils/debug";
import { useTranslation } from "react-i18next";
import { publicFetch } from "@/shared/services/api/safe-fetch";
import {
  validateContactField,
  formatContactPhoneNumber,
  validateContactForm,
} from "@/shared/utils/validation/contact-validation";

const CONTACT_SUBJECTS = {
  GENERAL: "general",
  SUBSCRIPTION: "subscription",
  BILLING: "billing",
  TECHNICAL: "technical",
  OTHER: "other",
} as const;

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

interface ContactFormProps {
  onSuccess: () => void;
}

export default function ContactForm({ onSuccess }: ContactFormProps) {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>(() => ({
    name: "",
    email: "",
    phone: "",
    subject: CONTACT_SUBJECTS.GENERAL,
    message: "",
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(
    {}
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const validateAndSetError = (fieldName: string, value: string) => {
    const validation =
      validateContactField[fieldName as keyof typeof validateContactField]?.(
        value
      );
    if (validation) {
      setFieldErrors((prev) => ({
        ...prev,
        [fieldName]: validation.isValid ? null : validation.error,
      }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Format phone number on change
    let formattedValue = value;
    if (name === "phone") {
      formattedValue = formatContactPhoneNumber(value);
    }

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));

    // Validate if field has been touched
    if (touched[name]) {
      validateAndSetError(name, name === "phone" ? value : formattedValue);
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateAndSetError(name, value);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      subject: CONTACT_SUBJECTS.GENERAL,
      message: "",
    });
    setFieldErrors({});
    setTouched({});
  };

  const getFieldIcon = (fieldName: string) => {
    if (!touched[fieldName]) return null;
    const error = fieldErrors[fieldName];
    if (error) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  const getFieldClasses = (fieldName: string) => {
    const baseClasses = "h-11 text-base border-2 rounded-lg transition-all";
    if (fieldErrors[fieldName] && touched[fieldName]) {
      return `${baseClasses} border-destructive/50 focus:border-destructive focus:ring-destructive/20`;
    }
    if (
      !fieldErrors[fieldName] &&
      touched[fieldName] &&
      formData[fieldName as keyof ContactFormData]
    ) {
      return `${baseClasses} border-green-500/50 focus:border-green-500`;
    }
    return `${baseClasses} border-border focus:border-primary focus:ring-primary/20`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    debugLog.info("Contact form submission started", {
      component: "ContactForm",
      subject: formData.subject,
    });

    // Validate all fields before submission
    const validation = validateContactForm(formData);
    if (!validation.isValid) {
      // Mark all fields as touched to show errors
      const allFieldsTouched = Object.keys(formData).reduce(
        (acc, key) => {
          acc[key] = true;
          return acc;
        },
        {} as Record<string, boolean>
      );

      setTouched(allFieldsTouched);
      setFieldErrors(validation.errors);
      setIsSubmitting(false);
      toast.error(t("contact_form_fix_errors"));
      return;
    }

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await publicFetch("/api/shared/contact-messages", {
        method: "POST",
        headers: {
          "x-timezone": timezone,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to submit form: ${response.status}`
        );
      }

      debugLog.info("Contact form submitted successfully", {
        component: "ContactForm",
      });

      toast.success(t("contact_form_success"));
      onSuccess();
      resetForm();
    } catch (error) {
      debugLog.error(
        "Contact form submission failed",
        {
          component: "ContactForm",
        },
        error
      );
      toast.error(t("contact_form_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-11 bg-muted rounded"></div>
          <div className="h-11 bg-muted rounded"></div>
          <div className="h-11 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-11 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label
          htmlFor="name"
          className="text-sm font-medium flex items-center gap-2"
        >
          {t("contact_form_your_name")}{" "}
          <span className="text-destructive">*</span>
          {getFieldIcon("name")}
        </Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={t("contact_form_placeholder_name")}
          required
          disabled={isSubmitting}
          className={getFieldClasses("name")}
        />
        {fieldErrors.name && touched.name && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="email"
          className="text-sm font-medium flex items-center gap-2"
        >
          {t("account_profile_email_address")}{" "}
          <span className="text-destructive">*</span>
          {getFieldIcon("email")}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={t("contact_form_placeholder_email")}
          required
          disabled={isSubmitting}
          className={getFieldClasses("email")}
        />
        {fieldErrors.email && touched.email && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="phone"
          className="text-sm font-medium flex items-center gap-2"
        >
          {t("account_profile_phone_number")}{" "}
          <span className="text-xs text-muted-foreground font-normal">
            {t("contact_form_phone_optional")}
          </span>
          {getFieldIcon("phone")}
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={t("account_profile_placeholder_phone")}
          disabled={isSubmitting}
          className={getFieldClasses("phone")}
        />
        {fieldErrors.phone && touched.phone && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          {t("contact_form_what_contacting")}{" "}
          <span className="text-destructive">*</span>
          {getFieldIcon("subject")}
        </Label>
        <RadioGroup
          name="subject"
          value={formData.subject}
          onValueChange={(value) => {
            setFormData((prev) => ({ ...prev, subject: value }));
            if (touched.subject) {
              validateAndSetError("subject", value);
            }
          }}
          disabled={isSubmitting}
          className="space-y-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value={CONTACT_SUBJECTS.GENERAL} id="general" />
            <Label
              htmlFor="general"
              className="text-sm font-normal cursor-pointer"
            >
              {t("contact_form_general_inquiry")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value={CONTACT_SUBJECTS.SUBSCRIPTION}
              id="subscription"
            />
            <Label
              htmlFor="subscription"
              className="text-sm font-normal cursor-pointer"
            >
              {t("contact_form_subscription_question")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value={CONTACT_SUBJECTS.BILLING} id="billing" />
            <Label
              htmlFor="billing"
              className="text-sm font-normal cursor-pointer"
            >
              {t("contact_form_billing_question")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value={CONTACT_SUBJECTS.TECHNICAL} id="technical" />
            <Label
              htmlFor="technical"
              className="text-sm font-normal cursor-pointer"
            >
              {t("contact_form_technical_support")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value={CONTACT_SUBJECTS.OTHER} id="other" />
            <Label
              htmlFor="other"
              className="text-sm font-normal cursor-pointer"
            >
              {t("contact_form_other")}
            </Label>
          </div>
        </RadioGroup>
        {fieldErrors.subject && touched.subject && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.subject}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="message"
          className="text-sm font-medium flex items-center gap-2"
        >
          {t("contact_form_your_message")}{" "}
          <span className="text-destructive">*</span>
          {getFieldIcon("message")}
        </Label>
        <Textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={t("contact_form_placeholder_message")}
          required
          disabled={isSubmitting}
          className={`min-h-[150px] resize-none text-base border-2 rounded-lg transition-all ${
            fieldErrors.message && touched.message
              ? "border-destructive/50 focus:border-destructive focus:ring-destructive/20"
              : !fieldErrors.message && touched.message && formData.message
                ? "border-green-500/50 focus:border-green-500"
                : "border-border focus:border-primary focus:ring-primary/20"
          }`}
        />
        {fieldErrors.message && touched.message && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full h-11 font-semibold shadow-sm hover:shadow-md transition-all"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("contact_form_sending")}
          </>
        ) : (
          t("contact_form_send_message")
        )}
      </Button>
    </form>
  );
}
