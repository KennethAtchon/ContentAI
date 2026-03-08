import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import { contactMessages } from "../../infrastructure/database/drizzle/schema";
import { and, desc, gte, lte, or, ilike, sql } from "drizzle-orm";
import { encrypt, decrypt } from "../../utils/security/encryption";
import { sendOrderConfirmationEmail } from "../../services/email/resend";
import { storage } from "../../services/storage";
import { generateSecureFilename } from "../../utils/validation/file-validation";
import { debugLog } from "../../utils/debug/debug";

const publicRoutes = new Hono<HonoEnv>();

// ─── GET /api/shared/contact-messages ────────────────────────────────────────

publicRoutes.get(
  "/contact-messages",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
      const search = c.req.query("search");
      const dateFrom = c.req.query("dateFrom");
      const dateTo = c.req.query("dateTo");
      const skip = (page - 1) * limit;

      const msgWhere = and(
        search
          ? or(
              ilike(contactMessages.name, `%${search}%`),
              ilike(contactMessages.email, `%${search}%`),
              ilike(contactMessages.subject, `%${search}%`),
            )
          : undefined,
        dateFrom
          ? gte(contactMessages.createdAt, new Date(dateFrom))
          : undefined,
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

      // Decrypt PII fields
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
              /* leave as-is */
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
    } catch (error) {
      debugLog.error("Failed to fetch contact messages", {
        service: "public-route",
        operation: "getContactMessages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch contact messages" }, 500);
    }
  },
);

// ─── POST /api/shared/contact-messages ───────────────────────────────────────

publicRoutes.post("/contact-messages", rateLimiter("public"), async (c) => {
  try {
    const data = await c.req.json();
    const { name, email, phone, subject, message } = data;

    if (!name || !email || !subject || !message) {
      return c.json(
        { error: "name, email, subject, and message are required" },
        400,
      );
    }

    // Basic spam detection
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /(.)\1{50,}/gi,
    ];

    const content = `${name} ${subject} ${message}`;
    const isSuspicious = suspiciousPatterns.some((p) => p.test(content));
    if (isSuspicious) {
      return c.json(
        {
          error:
            "Your message could not be submitted. Please ensure your message contains appropriate content.",
        },
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
        name: contactMessages.name,
        email: contactMessages.email,
        subject: contactMessages.subject,
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
  } catch (error) {
    debugLog.error("Failed to create contact message", {
      service: "public-route",
      operation: "createContactMessage",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      {
        error:
          "Unable to send your message at this time. Please try again later.",
      },
      500,
    );
  }
});

// ─── POST /api/shared/emails ──────────────────────────────────────────────────

publicRoutes.post("/emails", rateLimiter("public"), async (c) => {
  try {
    const body = await c.req.json();
    const {
      customerName,
      customerEmail,
      orderId,
      therapies,
      products,
      totalAmount,
      address,
      phone,
    } = body;

    if (!customerName || !customerEmail || !orderId || !totalAmount) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const result = await sendOrderConfirmationEmail({
      customerName,
      customerEmail,
      orderId,
      therapies: therapies || [],
      products: products || [],
      totalAmount,
      address,
      phone,
    });

    if (result.success) {
      return c.json({
        success: true,
        message: "Confirmation email sent successfully",
        emailId: result.id,
      });
    } else {
      return c.json(
        { error: "Failed to send confirmation email", details: result.error },
        500,
      );
    }
  } catch (error) {
    debugLog.error("Failed to send email", {
      service: "public-route",
      operation: "sendOrderConfirmationEmail",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to send email" }, 500);
  }
});

// ─── POST /api/shared/upload ──────────────────────────────────────────────────

publicRoutes.post(
  "/upload",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;

      if (!file) return c.json({ error: "No file provided" }, 400);

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return c.json({ error: "File size exceeds 10MB limit" }, 400);
      }

      const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedMimeTypes.includes(file.type)) {
        return c.json(
          { error: "File type not allowed. Only images are accepted." },
          400,
        );
      }

      const filename = generateSecureFilename(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await storage.uploadFile(buffer, filename, file.type);

      return c.json({ success: true, url, filename });
    } catch (error) {
      debugLog.error("Failed to upload file", {
        service: "public-route",
        operation: "uploadFile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to upload file" }, 500);
    }
  },
);

export default publicRoutes;
