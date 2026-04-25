/**
 * Email service using Resend API (no SMTP required)
 * Requires RESEND_API_KEY environment variable
 * Sign up at resend.com to get your API key
 */

import { systemLogger } from "@/utils/system/system-logger";
import * as fs from "fs";
import * as path from "path";
import { debugLog } from "@/utils/debug";
import { externalServiceFetch } from "@/services/http/safe-fetch";

import {
  RESEND_FROM_EMAIL,
  RESEND_REPLY_TO_EMAIL,
  RESEND_API_KEY,
  DEBUG_ENABLED,
} from "@/utils/config/envUtil";
import {
  APP_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "@/constants/app.constants";

const SENDING_EMAIL = RESEND_FROM_EMAIL;
const REPLY_TO_EMAIL = RESEND_REPLY_TO_EMAIL;
const BUSINESS_NAME = APP_NAME;
const RESEND_API_URL = "https://api.resend.com/emails";
const ORDER_ID_DISPLAY_LENGTH = 8;
const TEMPLATE_PATH = "public/templates/order-confirmation.html";

interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
}

interface OrderEmailData {
  customerName: string;
  customerEmail: string;
  orderId: string;
  therapies?: Array<{
    name: string;
    quantity: number;
    price: string;
  }>;
  products?: Array<{
    name: string;
    quantity: number;
    price: string;
  }>;
  totalAmount: string;
  address: string;
  phone?: string;
  notes?: string;
  zoomMeetingId?: string;
  zoomPassword?: string;
  zoomMeetingNumber?: string;
  preparationInstructions?: string;
}

export async function sendEmail(options: EmailOptions) {
  debugLog.info(
    "Checking RESEND_API_KEY",
    { service: "resend" },
    {
      hasKey: !!RESEND_API_KEY,
      keyLength: RESEND_API_KEY?.length || 0,
      keyPrefix: RESEND_API_KEY?.substring(0, 10) || "undefined",
    },
  );

  if (!RESEND_API_KEY) {
    systemLogger.warn("RESEND_API_KEY not found in environment variables", {
      service: "resend",
    });
    debugLog.info(
      "Email would be sent in production",
      { service: "resend" },
      {
        to: options.to,
        subject: options.subject,
        from: options.from || `${BUSINESS_NAME} <${SENDING_EMAIL}>`,
      },
    );
    return { success: true, id: "dev-mode" };
  }

  // Validate email addresses
  const allEmails = [
    ...options.to,
    ...(options.cc || []),
    ...(options.bcc || []),
  ];
  const invalidEmails = allEmails.filter((email) => !isValidEmail(email));
  if (invalidEmails.length > 0) {
    const error = `Invalid email addresses: ${invalidEmails.join(", ")}`;
    systemLogger.error(
      "Email validation failed",
      { service: "resend" },
      { invalidEmails },
    );
    return { success: false, error };
  }

  try {
    debugLog.info(
      "Sending email via Resend API",
      { service: "resend" },
      {
        to: options.to,
        subject: options.subject,
        from: options.from || `${BUSINESS_NAME} <${SENDING_EMAIL}>`,
      },
    );

    const emailPayload = {
      from: options.from || `${BUSINESS_NAME} <${SENDING_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      reply_to: REPLY_TO_EMAIL,
      ...(options.cc && options.cc.length > 0 && { cc: options.cc }),
      ...(options.bcc && options.bcc.length > 0 && { bcc: options.bcc }),
    };

    const response = await externalServiceFetch.general(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { message: errorText };
      }

      systemLogger.error(
        "Resend API error",
        { service: "resend" },
        {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails,
        },
      );

      throw new Error(
        `Resend API error (${response.status}): ${errorDetails.message || errorText}`,
      );
    }

    const result = (await response.json()) as { id: string };
    debugLog.info(
      "Email sent successfully",
      { service: "resend" },
      { emailId: result.id },
    );
    return { success: true, id: result.id };
  } catch (error) {
    systemLogger.error("Failed to send email", { service: "resend" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Email validation helper
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Test function for debugging email sending
export async function sendTestEmail(testEmail: string) {
  debugLog.info("Sending test email", { service: "resend" }, { to: testEmail });

  return await sendEmail({
    to: [testEmail],
    subject: "Email Test",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #0d9488;">✅ Email Test Successful!</h2>
        <p>This is a test email to verify that our email system is working correctly.</p>
        <p><strong>Time sent:</strong> ${new Date().toISOString()}</p>
        <p>If you received this email, the Resend integration is working properly.</p>
        <hr style="margin: 20px 0; border: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #6b7280;">
          ${BUSINESS_NAME}<br>
          This is an automated test message.
        </p>
      </div>
    `,
  });
}

export function generateOrderConfirmationEmail(data: OrderEmailData): string {
  const template = loadEmailTemplate();
  return populateTemplate(template, data);
}

/**
 * Load email template from file system or fallback
 */
function loadEmailTemplate(): string {
  try {
    const templatePath = path.join(process.cwd(), TEMPLATE_PATH);

    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, "utf8");
    } else {
      systemLogger.warn(
        `Email template not found at ${TEMPLATE_PATH}. Using fallback template`,
        { service: "resend" },
      );
      return generateFallbackTemplate();
    }
  } catch (error) {
    systemLogger.error(
      "Error reading email template",
      { service: "resend" },
      error,
    );
    systemLogger.warn("Using fallback email template", { service: "resend" });
    return generateFallbackTemplate();
  }
}

/**
 * Populate template with order data
 */
function populateTemplate(template: string, data: OrderEmailData): string {
  let populatedTemplate = template;

  // Replace basic template variables
  populatedTemplate = populatedTemplate.replace(
    /\{\{CUSTOMER_NAME\}\}/g,
    data.customerName,
  );
  populatedTemplate = populatedTemplate.replace(
    /\{\{CUSTOMER_EMAIL\}\}/g,
    data.customerEmail,
  );
  populatedTemplate = populatedTemplate.replace(
    /\{\{ORDER_ID_SHORT\}\}/g,
    data.orderId.slice(-ORDER_ID_DISPLAY_LENGTH).toUpperCase(),
  );
  populatedTemplate = populatedTemplate.replace(
    /\{\{ADDRESS\}\}/g,
    data.address,
  );
  populatedTemplate = populatedTemplate.replace(
    /\{\{TOTAL_AMOUNT\}\}/g,
    data.totalAmount,
  );

  // Brand placeholders (from app.constants)
  populatedTemplate = populatedTemplate.replace(/\{\{APP_NAME\}\}/g, APP_NAME);
  populatedTemplate = populatedTemplate.replace(
    /\{\{SUPPORT_EMAIL\}\}/g,
    SUPPORT_EMAIL,
  );
  populatedTemplate = populatedTemplate.replace(
    /\{\{SUPPORT_PHONE\}\}/g,
    SUPPORT_PHONE,
  );

  // Handle optional sections
  const phoneSection = generatePhoneSection(data.phone);
  populatedTemplate = populatedTemplate.replace(
    /\{\{PHONE_SECTION\}\}/g,
    phoneSection,
  );

  // Generate dynamic sections
  const therapiesList = generateTherapiesList(data.therapies || data.products);
  populatedTemplate = populatedTemplate.replace(
    /\{\{THERAPIES_LIST\}\}/g,
    therapiesList,
  );
  populatedTemplate = populatedTemplate.replace(
    /\{\{PRODUCTS_LIST\}\}/g,
    therapiesList,
  );

  const notesSection = generateNotesSection(data.notes);
  populatedTemplate = populatedTemplate.replace(
    /\{\{NOTES_SECTION\}\}/g,
    notesSection,
  );

  return populatedTemplate;
}

function generateFallbackTemplate(): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 32px 24px; text-align: center; }
        .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .header p { font-size: 16px; opacity: 0.9; }
        .content { padding: 32px 24px; }
        .greeting { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; }
        .intro { font-size: 16px; color: #6b7280; margin-bottom: 32px; }
        .section { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
        .section h3 { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-weight: 500; color: #374151; }
        .info-value { color: #6b7280; }
        .therapy-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid #e5e7eb; }
        .therapy-item:last-child { border-bottom: none; }
        .therapy-name { font-weight: 500; color: #374151; }
        .therapy-quantity { font-size: 14px; color: #6b7280; margin-left: 8px; }
        .therapy-price { font-weight: 600; color: #0d9488; }
        .total-row { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 18px; font-weight: 600; color: #065f46; }
        .total-amount { font-size: 24px; font-weight: 700; color: #059669; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
        .footer .brand { font-weight: 600; color: #0d9488; }
        .medical-notes-section { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
        .medical-notes-section h3 { color: #991b1b; }
        .medical-notes-section p { color: #7f1d1d; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Order Confirmed</h1>
            <p>Thank you for your order!</p>
        </div>
        
        <div class="content">
            <div class="greeting">Hello {{CUSTOMER_NAME}},</div>
            <div class="intro">
                We've received your order and will process it shortly.
            </div>
            
            <div class="section">
                <h3>Order Information</h3>
                <div class="info-row">
                    <span class="info-label">Order ID</span>
                    <span class="info-value">#{{ORDER_ID_SHORT}}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Customer</span>
                    <span class="info-value">{{CUSTOMER_NAME}}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email</span>
                    <span class="info-value">{{CUSTOMER_EMAIL}}</span>
                </div>
                {{PHONE_SECTION}}
                <div class="info-row">
                    <span class="info-label">Service Address</span>
                    <span class="info-value">{{ADDRESS}}</span>
                </div>
            </div>
            
            <div class="section">
                <h3>Selected Therapies</h3>
                {{THERAPIES_LIST}}
                <div class="total-row">
                    <span class="total-label">Total Amount</span>
                    <span class="total-amount">\${{TOTAL_AMOUNT}}</span>
                </div>
            </div>
            
            {{NOTES_SECTION}}
            
            <div class="section">
                <h3>What Happens Next?</h3>
                <ol>
                    <li>Our team will contact you within 24 hours to answer any questions.</li>
                    <li>We'll send you detailed preparation instructions to ensure optimal results from your therapy.</li>
                    <li>Our licensed professionals will arrive at your location with all necessary equipment and medications.</li>
                    <li>Payment will be collected at the time of service for your convenience.</li>
                </ol>
            </div>
            
            <div class="section">
                <h3>Need Assistance?</h3>
                <p>Our wellness specialists are here to help with any questions or concerns:</p>
                <p><strong>Email:</strong> ${SUPPORT_EMAIL}</p>
                <p><strong>Phone:</strong> ${SUPPORT_PHONE}</p>
            </div>
        </div>
        
        <div class="footer">
            <p class="brand">${BUSINESS_NAME}</p>
            <p>This confirmation was sent to {{CUSTOMER_EMAIL}}</p>
            <p>If you received this email in error, please contact our support team.</p>
        </div>
    </div>
</body>
</html>`;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData) {
  const html = generateOrderConfirmationEmail(data);
  const orderIdShort = data.orderId.slice(-ORDER_ID_DISPLAY_LENGTH);

  return await sendEmail({
    to: [data.customerEmail],
    subject: `Order Confirmation (Order #${orderIdShort})`,
    html,
    cc: [REPLY_TO_EMAIL],
  });
}

/**
 * Helper functions for template generation
 */
function _isDebugMode(): boolean {
  return DEBUG_ENABLED;
}

function generatePhoneSection(phone?: string): string {
  return phone
    ? `<div class="info-row">
                    <span class="info-label">Phone</span>
                    <span class="info-value">${phone}</span>
                </div>`
    : "";
}

function generateTherapiesList(
  therapies?: OrderEmailData["therapies"] | OrderEmailData["products"],
): string {
  if (!therapies || therapies.length === 0) {
    return '<div class="therapy-item"><span>No items</span></div>';
  }
  return therapies
    .map(
      (therapy) => `
    <div class="therapy-item">
      <div>
        <span class="therapy-name">${therapy.name}</span>
        <span class="therapy-quantity">× ${therapy.quantity} </span>
      </div>
      <span class="therapy-price">$${(parseFloat(therapy.price) * therapy.quantity).toFixed(2)}</span>
    </div>
  `,
    )
    .join("");
}

function generateNotesSection(notes?: string): string {
  return notes
    ? `<div class="section">
         <h3>Additional Notes</h3>
         <p>${notes}</p>
       </div>`
    : "";
}
