import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { publicService } from "../../domain/singletons";
import { sendOrderConfirmationEmail } from "../../services/email/resend";
import { storage } from "../../services/storage";
import { generateSecureFilename } from "../../utils/validation/file-validation";
import { AppError } from "../../utils/errors/app-error";
import {
  contactMessagesQuerySchema,
  createContactMessageSchema,
  sendOrderConfirmationEmailSchema,
} from "../../domain/public/public.schemas";

const publicRoutes = new Hono<HonoEnv>();

publicRoutes.get(
  "/contact-messages",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", contactMessagesQuerySchema, zodValidationErrorHook),
  async (c) => {
    const body = await publicService.listContactMessagesForAdmin(
      c.req.valid("query"),
    );
    return c.json(body);
  },
);

publicRoutes.post(
  "/contact-messages",
  rateLimiter("public"),
  zValidator("json", createContactMessageSchema, zodValidationErrorHook),
  async (c) => {
    const body = await publicService.createContactMessage(c.req.valid("json"));
    return c.json(body, 201);
  },
);

publicRoutes.post(
  "/emails",
  rateLimiter("public"),
  zValidator("json", sendOrderConfirmationEmailSchema, zodValidationErrorHook),
  async (c) => {
    const {
      customerName,
      customerEmail,
      orderId,
      therapies,
      products,
      totalAmount,
      address,
      phone,
    } = c.req.valid("json");

    const result = await sendOrderConfirmationEmail({
      customerName,
      customerEmail,
      orderId,
      therapies,
      products,
      totalAmount,
      address,
      phone,
    });

    if (!result.success) {
      throw new AppError(
        "Failed to send confirmation email",
        "EMAIL_SEND_FAILED",
        500,
        { reason: result.error },
      );
    }

    return c.json({
      success: true,
      message: "Confirmation email sent successfully",
      emailId: result.id,
    });
  },
);

publicRoutes.post(
  "/upload",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new AppError("No file provided", "INVALID_INPUT", 400);
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new AppError("File size exceeds 10MB limit", "INVALID_INPUT", 400);
    }

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      throw new AppError(
        "File type not allowed. Only images are accepted.",
        "INVALID_INPUT",
        400,
      );
    }

    const filename = generateSecureFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await storage.uploadFile(buffer, filename, file.type);

    return c.json({ success: true, url, filename });
  },
);

export default publicRoutes;
