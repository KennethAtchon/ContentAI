/**
 * Thank You Dialog Component - Modern SaaS Design
 *
 * Success dialog shown after contact form submission with modern SaaS styling.
 */

"use client";

import React from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";

const DIALOG_CONTENT = {
  TITLE: "Thank You!",
  DESCRIPTION:
    "Your message has been successfully sent. We will get back to you shortly.",
  CLOSE_BUTTON: "Close",
} as const;

interface ThankYouDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ThankYouDialog({
  isOpen,
  onOpenChange,
}: ThankYouDialogProps) {
  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <DialogTitle className="text-2xl">{DIALOG_CONTENT.TITLE}</DialogTitle>
          <DialogDescription className="text-base pt-2">
            {DIALOG_CONTENT.DESCRIPTION}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={handleClose} className="w-full sm:w-auto">
            {DIALOG_CONTENT.CLOSE_BUTTON}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
