import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";

export function OrdersSection() {
  const { t } = useTranslation();
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center gap-3">
      <Package className="h-9 w-9 text-dim-3" />
      <p className="font-medium text-dim-1">{t("account_orders_no_orders")}</p>
      <p className="text-sm text-dim-3 max-w-xs">
        {t(
          "common_your_order_history_will_appear_here_once_you_make_a_purchase"
        )}
      </p>
    </div>
  );
}
