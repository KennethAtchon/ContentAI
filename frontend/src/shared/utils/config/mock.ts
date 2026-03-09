/**
 * Mock data and helper functions using Drizzle types
 */

// Local type definitions matching Drizzle schema
export interface User {
  id: string;
  firebaseUid?: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  timezone?: string;
  role: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  lastLogin?: Date;
  hasUsedFreeTrial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  totalAmount: string;
  status?: string;
  stripeSessionId?: string;
  skipPayment: boolean;
  orderType: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  createdAt: Date;
}

export interface FeatureUsage {
  id: string;
  userId: string;
  featureType: string;
  inputData: unknown;
  resultData: unknown;
  usageTimeMs: number;
  createdAt: Date;
}

// Extended types for UI components with computed fields
export interface OrderWithDetails extends Omit<Order, "user"> {
  customer: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    initials: string;
  };
  products?: { name: string; quantity: number; price: number }[];
}

/**
 * Legacy mock data - kept for backward compatibility
 */
export interface MockOrder {
  id: string;
  customer: {
    name: string;
    email: string;
    avatar: string;
    initials: string;
  };
  date: string;
  products: { name: string; quantity: number; price: number }[];
  status: string;
  total: string;
}

/**
 * Products mock data
 */
export interface ProductData {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  status: string;
  image: string;
  stock: number;
  popular?: boolean;
  benefits?: string[];
  imageUrl?: string;
}

export function generateUserInitials(name: string): string {
  if (!name || typeof name !== "string") {
    return "";
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }

  // Special case: if it's just punctuation and spaces, return all non-space chars
  if (/^[^\w]*$/.test(trimmed)) {
    return trimmed.replace(/\s+/g, "");
  }

  // Split by spaces, then further split hyphenated words
  const words = trimmed.split(/\s+/).filter((word) => word.length > 0);

  if (words.length === 0) {
    return "";
  }

  // For each word, handle hyphens and apostrophes differently
  const allInitials: string[] = [];

  for (const word of words) {
    if (word.includes("-")) {
      // Split hyphenated words like "Jean-Claude" into "J" and "C"
      const hyphenatedParts = word.split("-").filter((part) => part.length > 0);
      for (const part of hyphenatedParts) {
        const cleanPart = part.replace(/^[^\w]+/, ""); // Remove leading punctuation
        if (cleanPart.length > 0) {
          allInitials.push(cleanPart[0]);
        } else if (part.length > 0) {
          allInitials.push(part[0]);
        }
      }
    } else {
      // For words with apostrophes like "O'Connor", treat as single word
      const cleanWord = word.replace(/^[^\w]+/, ""); // Remove leading punctuation
      if (cleanWord.length > 0) {
        allInitials.push(cleanWord[0]);
      } else if (word.length > 0) {
        allInitials.push(word[0]);
      }
    }
  }

  return allInitials.join("").toUpperCase();
}
