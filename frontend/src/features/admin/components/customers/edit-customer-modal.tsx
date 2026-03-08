"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
const FIELD_IDS = {
  NAME: "edit-customer-name",
  EMAIL: "edit-customer-email",
  PHONE: "edit-customer-phone",
  ADDRESS: "edit-customer-address",
} as const;

// Field labels are now translated - removed constant

// Field placeholders are now translated - removed constant

interface CustomerFormData {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  status?: string;
}

interface EditCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CustomerFormData;
  onFormChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => Promise<void> | void;
}

/**
 * Modal component for editing customer information
 */
export function EditCustomerModal({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
}: EditCustomerModalProps) {
  const { t } = useTranslation();

  /**
   * Handle form submission
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSave();
  };

  /**
   * Handle modal close
   */
  const handleClose = (): void => {
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("metadata_admin_customers_title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor={FIELD_IDS.NAME}>
              {t("admin_contact_messages_name")}
            </Label>
            <Input
              id={FIELD_IDS.NAME}
              name="name"
              value={form.name}
              onChange={onFormChange}
              placeholder={t("admin_customer_modal_placeholder_name")}
              required
            />
          </div>
          <div>
            <Label htmlFor={FIELD_IDS.EMAIL}>{t("common_email")}</Label>
            <Input
              id={FIELD_IDS.EMAIL}
              name="email"
              type="email"
              value={form.email}
              onChange={onFormChange}
              placeholder={t("admin_customer_modal_placeholder_email")}
              required
            />
          </div>
          <div>
            <Label htmlFor={FIELD_IDS.PHONE}>{t("common_phone_number")}</Label>
            <Input
              id={FIELD_IDS.PHONE}
              name="phone"
              type="tel"
              value={form.phone || ""}
              onChange={onFormChange}
              placeholder={t("admin_customer_modal_placeholder_phone")}
            />
          </div>
          <div>
            <Label htmlFor={FIELD_IDS.ADDRESS}>
              {t("account_profile_address")}
            </Label>
            <Input
              id={FIELD_IDS.ADDRESS}
              name="address"
              value={form.address || ""}
              onChange={onFormChange}
              placeholder={t("admin_customer_modal_placeholder_address")}
            />
          </div>
          <DialogFooter>
            <Button type="submit">{t("common_save")}</Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("common_cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
