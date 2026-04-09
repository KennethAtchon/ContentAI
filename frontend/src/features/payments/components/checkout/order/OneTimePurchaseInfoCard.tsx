import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Package } from "lucide-react";

export function OneTimePurchaseInfoCard({ t }: { t: (key: string) => string }) {
  return (
    <Card className="mt-6 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              {t("checkout_one_time_purchase")}
            </h3>
            <p className="text-base text-blue-700 dark:text-blue-300">
              {t("checkout_one_time_purchase_description")}{" "}
              <Link
                to="/pricing"
                className="underline font-medium hover:text-blue-900"
              >
                {t("checkout_our_pricing_page")}
              </Link>
              .
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
