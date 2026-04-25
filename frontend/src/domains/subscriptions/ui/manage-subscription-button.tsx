/**
 * Manage Subscription Button Component
 *
 * Button that opens the Stripe Customer Portal for users to manage their subscriptions.
 */

"use client";

import { debugLog } from "@/shared/debug";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/shared/ui/primitives/button";
import { usePortalLink } from "@/shared/react/use-portal-link";
import type { ButtonProps } from "@/shared/ui/primitives/button";

interface ManageSubscriptionButtonProps extends Omit<
  ButtonProps,
  "onClick" | "disabled"
> {
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export function ManageSubscriptionButton({
  className = "",
  children,
  disabled = false,
  ...buttonProps
}: ManageSubscriptionButtonProps) {
  const { t } = useTranslation();
  const { portalUrl, isLoading, error } = usePortalLink();
  const defaultChildren =
    children || t("account_subscription_manage_subscription");

  const handleClick = () => {
    if (isLoading || disabled || !portalUrl) return;

    if (error) {
      debugLog.error(
        "Error opening customer portal",
        {
          service: "subscription-button",
          operation: "handleClick",
        },
        error
      );
      toast.error(t("subscription_manage_failed"));
      return;
    }

    // Redirect to Stripe Customer Portal
    window.location.href = portalUrl;
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading || disabled || !portalUrl}
      className={className}
      {...buttonProps}
    >
      {isLoading ? t("subscription_manage_loading") : defaultChildren}
    </Button>
  );
}
