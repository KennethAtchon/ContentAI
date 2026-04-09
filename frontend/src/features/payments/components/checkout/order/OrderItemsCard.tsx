import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Package, ShoppingCart } from "lucide-react";
import type { OrderItem } from "../order-checkout.types";

interface OrderItemsCardProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItemPrice: (index: number, price: number) => void;
  onUpdateItemQuantity: (index: number, quantity: number) => void;
  t: (key: string) => string;
}

export function OrderItemsCard({
  items,
  onItemsChange,
  onAddItem,
  onRemoveItem,
  onUpdateItemPrice,
  onUpdateItemQuantity,
  t,
}: OrderItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          {t("checkout_order_items")}
        </CardTitle>
        <CardDescription>
          {t("common_review_and_adjust_your_order_items")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg"
          >
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`item-${index}-name`}>
                  {t("checkout_item_name")}
                </Label>
              </div>
              <Input
                id={`item-${index}-name`}
                value={item.name}
                onChange={(e) => {
                  const next = [...items];
                  next[index].name = e.target.value;
                  onItemsChange(next);
                }}
                placeholder={t("checkout_item_name_placeholder")}
              />
              <Input
                value={item.description}
                onChange={(e) => {
                  const next = [...items];
                  next[index].description = e.target.value;
                  onItemsChange(next);
                }}
                placeholder={t("checkout_description_placeholder")}
                className="text-base"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor={`item-${index}-price`}>
                    {t("checkout_price")}
                  </Label>
                  <Input
                    id={`item-${index}-price`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.price.toFixed(2)}
                    onChange={(e) =>
                      onUpdateItemPrice(index, parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="w-24">
                  <Label htmlFor={`item-${index}-quantity`}>
                    {t("checkout_quantity")}
                  </Label>
                  <Input
                    id={`item-${index}-quantity`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateItemQuantity(index, parseInt(e.target.value) || 1)
                    }
                  />
                </div>
              </div>
            </div>
            {items.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveItem(index)}
                className="self-start"
              >
                {t("checkout_remove")}
              </Button>
            )}
          </div>
        ))}

        <Button variant="outline" onClick={onAddItem} className="w-full">
          <Package className="mr-2 h-4 w-4" />
          {t("checkout_add_item")}
        </Button>
      </CardContent>
    </Card>
  );
}
