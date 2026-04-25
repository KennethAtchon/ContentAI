import { Package } from "lucide-react";

import { Button } from "@/shared/ui/primitives/button";

// Constants
const BUTTON_LABEL = "View products";
const BUTTON_TEXT = "Products";

interface OrderProductsButtonProps {
  onClick: () => void;
}

/**
 * Button component for viewing order products
 */
export function OrderProductsButton({ onClick }: OrderProductsButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="flex flex-col gap-0.5 w-full items-start px-2 py-1"
      onClick={onClick}
      type="button"
      aria-label={BUTTON_LABEL}
    >
      <span className="flex items-center gap-2 text-primary">
        <Package className="w-4 h-4 mr-1" />
        {BUTTON_TEXT}
      </span>
    </Button>
  );
}
