import { Card, CardContent } from "@/shared/components/ui/card";
import { Shield } from "lucide-react";

export function SecurityCard({ t }: { t: (key: string) => string }) {
  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
            <Shield className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">{t("checkout_secure_payment_processing")}</p>
            <p className="text-base text-muted-foreground">{t("checkout_payment_processed_securely")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

