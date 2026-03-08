import crypto from "crypto";

const ENCRYPTION_CONFIG = {
  ALGORITHM: "aes-256-gcm",
  IV_LENGTH: 12, // Recommended for GCM
  KEY_LENGTH: 32, // 256 bits
  ENCODING: {
    INPUT: "utf8",
    OUTPUT: "base64",
  },
} as const;

const ENCRYPTION_ERRORS = {
  MISSING_KEY: "Environment variable ENCRYPTION_KEY is required but not set",
  INVALID_KEY_LENGTH:
    "ENCRYPTION_KEY must be 32 characters (256 bits) for AES-256-GCM",
  INVALID_DATA_FORMAT: "Invalid encrypted data format",
} as const;

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(ENCRYPTION_ERRORS.MISSING_KEY);
  }
  if (key.length !== ENCRYPTION_CONFIG.KEY_LENGTH) {
    throw new Error(ENCRYPTION_ERRORS.INVALID_KEY_LENGTH);
  }
  return key;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_CONFIG.ALGORITHM,
    Buffer.from(getEncryptionKey()),
    iv,
  );

  let encrypted = cipher.update(
    text,
    ENCRYPTION_CONFIG.ENCODING.INPUT,
    ENCRYPTION_CONFIG.ENCODING.OUTPUT,
  );
  encrypted += cipher.final(ENCRYPTION_CONFIG.ENCODING.OUTPUT);
  const tag = cipher.getAuthTag();

  return [
    iv.toString(ENCRYPTION_CONFIG.ENCODING.OUTPUT),
    tag.toString(ENCRYPTION_CONFIG.ENCODING.OUTPUT),
    encrypted,
  ].join(":");
}

export function decrypt(data: string): string {
  const [ivB64, tagB64, encrypted] = data.split(":");

  if (!ivB64 || !tagB64 || !encrypted) {
    throw new Error(ENCRYPTION_ERRORS.INVALID_DATA_FORMAT);
  }

  const iv = Buffer.from(ivB64, ENCRYPTION_CONFIG.ENCODING.OUTPUT);
  const tag = Buffer.from(tagB64, ENCRYPTION_CONFIG.ENCODING.OUTPUT);
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_CONFIG.ALGORITHM,
    Buffer.from(getEncryptionKey()),
    iv,
  );

  decipher.setAuthTag(tag);
  let decrypted = decipher.update(
    encrypted,
    ENCRYPTION_CONFIG.ENCODING.OUTPUT,
    ENCRYPTION_CONFIG.ENCODING.INPUT,
  );
  decrypted += decipher.final(ENCRYPTION_CONFIG.ENCODING.INPUT);

  return decrypted;
}
