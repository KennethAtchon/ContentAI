export type UserRole = "customer" | "admin" | "staff" | "user";

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseUser {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface FirebaseDecodedToken {
  uid: string;
  email?: string;
  name?: string;
  role?: string;
  stripeRole?: string; // Set by Firebase Stripe Extension based on subscription
  [key: string]: unknown; // Allow other custom claims
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthResult {
  firebaseUser: FirebaseDecodedToken;
  userId: string;
  user: DatabaseUser;
}

export type AdminAuthResult = AuthResult;

export interface AdminAuthResultWithDbUserId extends AdminAuthResult {
  dbUserId: string;
  staffId: string;
}
