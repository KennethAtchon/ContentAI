import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import { contactMessages } from "../../infrastructure/database/drizzle/schema";
import { and, desc, gte, ilike, lte, or, sql } from "drizzle-orm";
import { encrypt, decrypt } from "../../utils/security/encryption";
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

type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

// ─── GET /api/shared/contact-messages ────────────────────────────────────────

publicRoutes.get(
  "/contact-messages",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", contactMessagesQuerySchema, validationErrorHook),
  async (c) => {
    const { page, limit, search, dateFrom, dateTo } = c.req.valid("query");
    const skip = (page - 1) * limit;

    const msgWhere = and(
      search
        ? or(
            ilike(contactMessages.name, `%${search}%`),
            ilike(contactMessages.email, `%${search}%`),
            ilike(contactMessages.subject, `%${search}%`),
          )
        : undefined,
      dateFrom ? gte(contactMessages.createdAt, new Date(dateFrom)) : undefined,
      dateTo ? lte(contactMessages.createdAt, new Date(dateTo)) : undefined,
    );

    const [rawMessages, [{ total }]] = await Promise.all([
      db
        .select()
        .from(contactMessages)
        .where(msgWhere)
        .orderBy(desc(contactMessages.createdAt))
        .limit(limit)
        .offset(skip),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(contactMessages)
        .where(msgWhere),
    ]);

    const ENCRYPTED_FIELDS = [
      "name",
      "email",
      "phone",
      "subject",
      "message",
    ] as const;

    const messages = rawMessages.map((msg) => {
      const decrypted = { ...msg };
      for (const field of ENCRYPTED_FIELDS) {
        if (decrypted[field]) {
          try {
            (decrypted as any)[field] = decrypt(decrypted[field] as string);
          } catch {
            // Leave undecryptable content as-is so admin can still inspect record.
          }
        }
      }
      return decrypted;
    });

    const totalPages = Math.ceil(total / limit);
    return c.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  },
);

// ─── POST /api/shared/contact-messages ───────────────────────────────────────

publicRoutes.post(
  "/contact-messages",
  rateLimiter("public"),
  zValidator("json", createContactMessageSchema, validationErrorHook),
  async (c) => {
    const { name, email, phone, subject, message } = c.req.valid("json");

    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /(.)\1{50,}/gi,
    ];

    const content = `${name} ${subject} ${message}`;
    const isSuspicious = suspiciousPatterns.some((pattern) =>
      pattern.test(content),
    );

    if (isSuspicious) {
      throw new AppError(
        "Your message could not be submitted. Please ensure your message contains appropriate content.",
        "INVALID_INPUT",
        400,
      );
    }

    const [newMessage] = await db
      .insert(contactMessages)
      .values({
        name: encrypt(name),
        email: encrypt(email),
        phone: phone ? encrypt(phone) : null,
        subject: encrypt(subject),
        message: encrypt(message),
      })
      .returning({
        id: contactMessages.id,
        createdAt: contactMessages.createdAt,
      });

    return c.json(
      {
        message:
          "Your message has been sent successfully. We will get back to you soon.",
        id: newMessage.id,
        timestamp: newMessage.createdAt,
      },
      201,
    );
  },
);

// ─── POST /api/shared/emails ──────────────────────────────────────────────────

publicRoutes.post(
  "/emails",
  rateLimiter("public"),
  zValidator("json", sendOrderConfirmationEmailSchema, validationErrorHook),
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

// ─── POST /api/shared/upload ──────────────────────────────────────────────────

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
