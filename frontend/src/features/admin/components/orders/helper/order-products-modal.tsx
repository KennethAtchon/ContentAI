import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import React from "react";

type Order = {
  id: string;
};

interface OrderProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

export function OrderProductsModal({
  open,
  onOpenChange,
  order,
}: OrderProductsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">
              Order details feature removed - SaaS model.
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
