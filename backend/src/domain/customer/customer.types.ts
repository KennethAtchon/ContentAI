/**
 * Shared customer / user shapes for API and services.
 */

export interface Customer {
  id: string;
  firebaseUid: string | null;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  timezone: string | null;
  role: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  hasUsedFreeTrial: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Subset returned by GET /api/customer/profile */
export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  role: string;
  timezone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerRequest {
  name: string;
  email: string;
  password?: string;
  timezone?: string;
  createInFirebase?: boolean;
}

export interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  timezone?: string;
  isActive?: boolean;
  role?: string;
}
