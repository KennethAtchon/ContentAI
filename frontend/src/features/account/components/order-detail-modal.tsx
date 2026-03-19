"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Package, Phone, Mail, Download } from "lucide-react";
import { formatDateWithTimezone } from "@/shared/utils/helpers/date";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { debugLog } from "@/shared/utils/debug";
import { useTranslation } from "react-i18next";
import { SUPPORT_EMAIL } from "@/shared/constants/app.constants";

// Constants
const COMPONENT_NAME = "OrderDetailModal";
const SUPPORT_PHONE = "+1 (555) 123-4567";
const DEFAULT_PRICE = 0;
const ORDER_ID_DISPLAY_LENGTH = 8;

const STATUS_COLORS = {
  completed: "default",
  confirmed: "default",
  pending: "secondary",
  cancelled: "destructive",
  processing: "secondary",
} as const;

// MESSAGES are now translated - removed constant

// Order interface for modal - SaaS model, no products
interface Order {
  id: string;
  totalAmount: number | string | { toNumber: () => number };
  status: string;
  createdAt: string;
}

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Extract numeric price value from various price formats
 */
const extractPrice = (
  priceValue: number | string | { toNumber: () => number } | undefined
): number => {
  if (typeof priceValue === "number") return priceValue;
  if (typeof priceValue === "string")
    return parseFloat(priceValue) || DEFAULT_PRICE;
  if (
    priceValue &&
    typeof priceValue === "object" &&
    "toNumber" in priceValue
  ) {
    return priceValue.toNumber();
  }
  return DEFAULT_PRICE;
};

/**
 * Get badge color for order status
 */
const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase() as keyof typeof STATUS_COLORS;
  return STATUS_COLORS[statusLower] || "secondary";
};

export function OrderDetailModal({
  order,
  open,
  onOpenChange,
}: OrderDetailModalProps) {
  const { t } = useTranslation();

  if (!order) return null;

  const subtotal = extractPrice(order.totalAmount);

  const handleDownloadReceipt = async () => {
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const { width, height } = page.getSize();

      // Load fonts
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      // Enhanced color palette
      const primaryBlue = rgb(0.1, 0.4, 0.8);
      const accentTeal = rgb(0.2, 0.7, 0.6);
      const darkGray = rgb(0.2, 0.2, 0.2);
      const mediumGray = rgb(0.4, 0.4, 0.4);
      const lightGray = rgb(0.7, 0.7, 0.7);
      const white = rgb(1, 1, 1);
      const green = rgb(0.2, 0.7, 0.3);

      // Background header box
      page.drawRectangle({
        x: 0,
        y: height - 120,
        width: width,
        height: 120,
        color: primaryBlue,
      });

      // Company header
      let yPosition = height - 45;
      page.drawText(t("order_detail_pdf_company_name"), {
        x: 50,
        y: yPosition,
        size: 28,
        font: boldFont,
        color: white,
      });

      page.drawText(t("order_detail_pdf_company_tagline"), {
        x: 50,
        y: yPosition - 25,
        size: 12,
        font: italicFont,
        color: white,
      });

      // Receipt badge
      page.drawRectangle({
        x: width - 140,
        y: yPosition - 15,
        width: 90,
        height: 30,
        color: accentTeal,
      });

      page.drawText(t("order_detail_pdf_receipt"), {
        x: width - 125,
        y: yPosition - 7,
        size: 14,
        font: boldFont,
        color: white,
      });

      // Order information section
      yPosition = height - 160;

      // Order info box background
      page.drawRectangle({
        x: 40,
        y: yPosition - 40,
        width: width - 80,
        height: 70,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: lightGray,
        borderWidth: 1,
      });

      // Order details
      yPosition -= 15;
      page.drawText(
        t("order_detail_pdf_order_number", {
          orderId: order.id.slice(-ORDER_ID_DISPLAY_LENGTH),
        }),
        {
          x: 60,
          y: yPosition,
          size: 18,
          font: boldFont,
          color: darkGray,
        }
      );

      page.drawText(
        t("order_detail_pdf_date", {
          date: formatDateWithTimezone(order.createdAt, "MMM dd, yyyy"),
        }),
        {
          x: width - 180,
          y: yPosition,
          size: 12,
          font: regularFont,
          color: mediumGray,
        }
      );

      const statusColor =
        order.status.toLowerCase() === "completed" ? green : mediumGray;
      const statusText =
        order.status.charAt(0).toUpperCase() + order.status.slice(1);
      page.drawText(t("order_detail_pdf_status", { status: statusText }), {
        x: width - 180,
        y: yPosition - 18,
        size: 12,
        font: boldFont,
        color: statusColor,
      });

      // Summary section
      yPosition -= 60;

      // Summary box background
      page.drawRectangle({
        x: 320,
        y: yPosition - 80,
        width: 250,
        height: 100,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: lightGray,
        borderWidth: 1,
      });

      yPosition -= 15;

      // Subtotal
      page.drawText(t("order_detail_pdf_subtotal"), {
        x: 340,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: mediumGray,
      });
      page.drawText(`$${subtotal.toFixed(2)}`, {
        x: 490,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: mediumGray,
      });

      // Tax
      yPosition -= 20;
      page.drawText(t("order_detail_pdf_tax"), {
        x: 340,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: mediumGray,
      });
      page.drawText(t("order_detail_pdf_tax_included"), {
        x: 490,
        y: yPosition,
        size: 12,
        font: italicFont,
        color: mediumGray,
      });

      // Separator line
      yPosition -= 15;
      page.drawLine({
        start: { x: 340, y: yPosition },
        end: { x: 550, y: yPosition },
        thickness: 1,
        color: lightGray,
      });

      // Total
      yPosition -= 25;
      const totalAmount = (() => {
        const amount = order.totalAmount;
        if (typeof amount === "number") return amount;
        if (typeof amount === "string") return parseFloat(amount);
        if (amount && typeof amount === "object" && "toNumber" in amount)
          return amount.toNumber();
        return 0;
      })();

      page.drawRectangle({
        x: 320,
        y: yPosition - 8,
        width: 250,
        height: 25,
        color: primaryBlue,
      });

      page.drawText(t("order_detail_pdf_total"), {
        x: 340,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: white,
      });
      page.drawText(`$${totalAmount.toFixed(2)}`, {
        x: 490,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: white,
      });

      // Footer section
      yPosition -= 80;

      // Footer background
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 100,
        color: rgb(0.97, 0.97, 0.97),
      });

      // Thank you message
      page.drawText(t("order_detail_pdf_thank_you"), {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: primaryBlue,
      });

      page.drawText(t("order_detail_pdf_appreciation"), {
        x: 50,
        y: yPosition - 25,
        size: 11,
        font: regularFont,
        color: mediumGray,
      });

      // Contact information
      yPosition -= 50;
      page.drawText(t("order_detail_pdf_need_support"), {
        x: 50,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: darkGray,
      });

      page.drawText(t("order_detail_pdf_email", { email: SUPPORT_EMAIL }), {
        x: 50,
        y: yPosition - 20,
        size: 10,
        font: regularFont,
        color: mediumGray,
      });

      page.drawText(t("order_detail_pdf_phone", { phone: SUPPORT_PHONE }), {
        x: 50,
        y: yPosition - 35,
        size: 10,
        font: regularFont,
        color: mediumGray,
      });

      // Receipt footer info
      page.drawText(
        t("order_detail_pdf_generated_on", {
          date: new Date().toLocaleDateString(),
        }),
        {
          x: width - 200,
          y: yPosition - 20,
          size: 9,
          font: italicFont,
          color: lightGray,
        }
      );

      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();

      // Download the PDF
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${order.id.slice(-8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      debugLog.error(
        t("order_detail_pdf_error"),
        { component: COMPONENT_NAME },
        error
      );
      // Fallback to JSON if PDF generation fails
      const receiptData = {
        orderId: order.id,
        date: order.createdAt,
        total: order.totalAmount,
      };

      const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${order.id.slice(-8)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleContactSupport = (method: "phone" | "email") => {
    if (method === "phone") {
      window.open(`tel:${SUPPORT_PHONE}`, "_self");
    } else {
      const subject = `Order Support - ${order.id.slice(-ORDER_ID_DISPLAY_LENGTH)}`;
      window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}`, "_self");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order #{order.id.slice(-ORDER_ID_DISPLAY_LENGTH)}
            </span>
            <Badge variant={getStatusColor(order.status)}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Details */}
          <div className="grid grid-cols-2 gap-4 text-base">
            <div>
              <p className="text-muted-foreground">
                {t("order_detail_order_date")}
              </p>
              <p className="font-medium">
                {formatDateWithTimezone(order.createdAt, "MMM dd, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t("order_detail_order_id")}
              </p>
              <p className="font-medium">{order.id}</p>
            </div>
          </div>

          <Separator />

          {/* Order Summary */}
          <div className="space-y-3">
            <h3 className="font-semibold">{t("order_detail_order_summary")}</h3>
            <div className="space-y-2 text-base">
              <div className="flex justify-between">
                <span>{t("order_detail_subtotal")}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t("order_detail_tax")}</span>
                <span>{t("order_detail_pdf_tax_included")}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-xl">
                <span>{t("admin_contact_messages_total")}</span>
                <span>${extractPrice(order.totalAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 flex items-center gap-2 relative z-10"
              onClick={handleDownloadReceipt}
            >
              <Download className="h-4 w-4" />
              {t("order_detail_download_receipt")}
            </Button>
          </div>

          {/* Contact Support */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium">{t("payment_cancel_need_help")}</h4>
            <p className="text-base text-muted-foreground">
              {t("order_detail_help_description")}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 relative z-10"
                onClick={() => handleContactSupport("phone")}
              >
                <Phone className="h-4 w-4" />
                {t("order_detail_call_support")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 relative z-10"
                onClick={() => handleContactSupport("email")}
              >
                <Mail className="h-4 w-4" />
                {t("order_detail_email_support")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
