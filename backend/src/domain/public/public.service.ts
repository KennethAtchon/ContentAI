import { encrypt, decrypt } from "../../utils/security/encryption";
import { AppError } from "../../utils/errors/app-error";
import type { z } from "zod";
import type { IPublicRepository } from "./public.repository";
import type {
  contactMessagesQuerySchema,
  createContactMessageSchema,
} from "./public.schemas";

type ContactQuery = z.infer<typeof contactMessagesQuerySchema>;
type CreateContactBody = z.infer<typeof createContactMessageSchema>;

const ENCRYPTED_FIELDS = [
  "name",
  "email",
  "phone",
  "subject",
  "message",
] as const;

const SUSPICIOUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /(.)\1{50,}/gi,
];

export class PublicService {
  constructor(private readonly repo: IPublicRepository) {}

  async listContactMessagesForAdmin(query: ContactQuery) {
    const { page, limit, search, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const { rows: rawMessages, total } =
      await this.repo.listContactMessagesPage({
        limit,
        offset: skip,
        search,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      });

    const messages = rawMessages.map((msg) => {
      const decrypted = { ...msg };
      for (const field of ENCRYPTED_FIELDS) {
        const v = decrypted[field];
        if (v) {
          try {
            (decrypted as Record<string, unknown>)[field] = decrypt(
              v as string,
            );
          } catch {
            /* leave ciphertext if decrypt fails */
          }
        }
      }
      return decrypted;
    });

    const totalPages = Math.ceil(total / limit);
    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async createContactMessage(body: CreateContactBody) {
    const content = `${body.name} ${body.subject} ${body.message}`;
    const isSuspicious = SUSPICIOUS_PATTERNS.some((pattern) =>
      pattern.test(content),
    );
    if (isSuspicious) {
      throw new AppError(
        "Your message could not be submitted. Please ensure your message contains appropriate content.",
        "INVALID_INPUT",
        400,
      );
    }

    const row = await this.repo.insertContactMessage({
      name: encrypt(body.name),
      email: encrypt(body.email),
      phone: body.phone ? encrypt(body.phone) : null,
      subject: encrypt(body.subject),
      message: encrypt(body.message),
    });

    return {
      message:
        "Your message has been sent successfully. We will get back to you soon.",
      id: row.id,
      timestamp: row.createdAt,
    };
  }
}
