import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { ORDER_PRODUCTS } from "@/shared/constants/order.constants";

interface QuickAddProductsProps {
  onAddProduct: (product: (typeof ORDER_PRODUCTS)[0]) => void;
  t: (key: string) => string;
}

export function QuickAddProducts({ onAddProduct, t }: QuickAddProductsProps) {
  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <CardTitle className="text-xl">
          {t("checkout_quick_add_products")}
        </CardTitle>
        <CardDescription>
          {t("common_click_to_add_a_product_to_your_order")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER_PRODUCTS.slice(0, 4).map((product) => (
            <Button
              key={product.id}
              variant="outline"
              className="h-auto flex-col items-start p-3 text-left"
              onClick={() => onAddProduct(product)}
            >
              <div className="font-semibold text-base mb-1">{product.name}</div>
              <div className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {product.description}
              </div>
              <div className="text-base font-bold text-primary">
                ${product.price.toFixed(2)}
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
